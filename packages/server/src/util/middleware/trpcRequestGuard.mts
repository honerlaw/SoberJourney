import type { NextFunction, Request, RequestHandler, Response } from "express";
import superjson from "superjson";
import {
  TRPC_ERROR_CODES_BY_KEY,
  type TRPC_ERROR_CODE_KEY,
} from "@trpc/server/rpc";
import { getLimit, isSwitchOn } from "../limits.mjs";

/**
 * Cheap checks on /api/trpc requests, run before body parsing and before
 * tRPC resolves (and decrypts for) any procedure. Mount it ahead of
 * express.json() and the tRPC adapter.
 *
 * - Batch cap: tRPC has no limit on how many procedures one request batches,
 *   so one request could run journal.list hundreds of times. More than
 *   TRPC_MAX_BATCH_SIZE (default 25) procedures → HTTP 400. Procedures are
 *   counted the way tRPC reads them: the last path segment, decoded, split on
 *   "," (so "%2C" counts too). Applies to GET and POST alike.
 * - JSON-only POSTs: a POST must be application/json → otherwise HTTP 415.
 *   HTML forms can only send multipart/form-data, text/plain or urlencoded,
 *   so a cross-site form can no longer reach a mutation; a cross-site fetch
 *   with application/json needs a CORS preflight, and cors() never allows
 *   credentials. @trpc/client sends application/json on every POST, and a POST
 *   without a content-type is already rejected by tRPC today. Switch:
 *   TRPC_JSON_ONLY_POSTS=0.
 *
 * Rejections are one tRPC-shaped error object; httpBatchLink applies a
 * non-array error body to every operation in the batch. Never UNAUTHORIZED.
 */

function errorBody(
  code: TRPC_ERROR_CODE_KEY,
  httpStatus: number,
  message: string,
) {
  return {
    error: superjson.serialize({
      message,
      code: TRPC_ERROR_CODES_BY_KEY[code],
      data: { code, httpStatus },
    }),
  };
}

/** Number of procedures tRPC would resolve for this request path. */
export function countProcedures(requestPath: string): number {
  const last = requestPath.slice(requestPath.lastIndexOf("/") + 1);
  let decoded: string;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // tRPC fails such a path on its own; count what is visible
    decoded = last;
  }
  return decoded.split(",").length;
}

export function isJsonContentType(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const mediaType = value.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

export function trpcRequestGuard(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const maxBatch = getLimit("TRPC_MAX_BATCH_SIZE");
    if (maxBatch > 0 && countProcedures(req.path) > maxBatch) {
      res
        .status(400)
        .json(
          errorBody(
            "BAD_REQUEST",
            400,
            `Too many procedures in one request (at most ${maxBatch}).`,
          ),
        );
      return;
    }

    if (
      req.method === "POST" &&
      isSwitchOn("TRPC_JSON_ONLY_POSTS") &&
      !isJsonContentType(req.get("content-type"))
    ) {
      res
        .status(415)
        .json(
          errorBody(
            "UNSUPPORTED_MEDIA_TYPE",
            415,
            "Requests must be sent as application/json.",
          ),
        );
      return;
    }

    next();
  };
}
