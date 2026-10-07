/**
 * Shared tRPC root options (besides the transformer), exported so tests can
 * build a router with the same behavior.
 *
 * `jsonl.pingMs`: during idle gaps of a streamed (JSONL) response, tRPC
 * writes a whitespace keep-alive, so a slow first Gemini chunk does not look
 * like a dead connection to proxies in front of the server. Only the JSONL
 * branch reads it; non-streamed responses are unchanged.
 */
export const STREAM_PING_MS = 5_000;

export const TRPC_OPTIONS = {
  jsonl: { pingMs: STREAM_PING_MS },
} as const;
