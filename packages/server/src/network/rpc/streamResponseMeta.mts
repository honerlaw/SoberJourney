import type { ResponseMeta, TRPCRequestInfo } from "@trpc/server/http";

/**
 * Response headers for streamed (JSONL) tRPC responses, i.e. requests sent by
 * `httpBatchStreamLink` with `trpc-accept: application/jsonl`. They ask
 * proxies/CDNs in front of the server not to buffer or transform (compress)
 * the body, so chunks reach the client as they are written. Every other
 * response, including all calls from released apps (`httpBatchLink`), gets
 * nothing extra. Never throws: `info` is undefined on some early errors.
 */
export const STREAM_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
};

export function streamResponseMeta(opts: {
  info?: TRPCRequestInfo | undefined;
}): ResponseMeta {
  if (opts.info?.accept !== "application/jsonl") {
    return {};
  }
  return { headers: { ...STREAM_RESPONSE_HEADERS } };
}
