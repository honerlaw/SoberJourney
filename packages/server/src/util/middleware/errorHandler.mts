import { STATUS_CODES } from "node:http";
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";
import type { Logger } from "../logger/index.mjs";

/**
 * Terminal Express error handler. Without one, Express's default handler
 * renders err.stack (with absolute server paths) whenever its env is
 * "development", which is also its fallback when NODE_ENV is unset. That
 * reaches clients on, for example, a malformed or oversized JSON body.
 *
 * Keeps the error's status (body-parser sets 400/413/415) and answers with
 * the plain status text only. Never turns an error into a 401. Mount last.
 */
function statusOf(err: unknown): number {
  const status =
    (err as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 600
    ? status
    : 500;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = statusOf(err);
    const entry = {
      error: err,
      tags: ["http", "errorHandler"],
      attributes: { status, method: req.method, path: req.path },
    };
    if (status >= 500) {
      logger.error(entry, "Request failed");
    } else {
      logger.warn(entry, "Request failed");
    }

    res
      .status(status)
      .type("text/plain")
      .send(STATUS_CODES[status] ?? "Error");
  };
}
