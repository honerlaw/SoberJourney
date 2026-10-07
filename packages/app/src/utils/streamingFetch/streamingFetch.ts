import { fetch as expoFetch } from "expo/fetch"

/**
 * A `fetch` whose response body is a readable stream, for tRPC's
 * `httpBatchStreamLink`. React Native's global `fetch` buffers the whole
 * body, so native uses Expo's streaming fetch; on web `expo/fetch` is the
 * browser's own `fetch`.
 */
export const streamingFetch = ((input: string, init?: RequestInit) =>
  expoFetch(
    input,
    init as Parameters<typeof expoFetch>[1],
  )) as unknown as typeof globalThis.fetch
