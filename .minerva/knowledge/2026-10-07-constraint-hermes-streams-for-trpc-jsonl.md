# tRPC's JSONL stream link on React Native needs expo/fetch and Web Streams from a single implementation

**Date**: 2026-10-07
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: RN fetch can't stream bodies (use expo/fetch); Web Streams must come from one implementation (Expo 54 Metro injects them)
**Context**: .minerva/work/2026-10-07-sponsor-chat-streaming (see git history if the worktree has been cleaned up)

## Context
Issue #33 streams Sponsor replies through `httpBatchStreamLink`. tRPC's `jsonlStreamConsumer` (in @trpc/server 11.8.1's `resolveResponse`) reads `response.body.getReader()`. It pipes the body through `TextDecoderStream` and `TransformStream`s, then into `new WritableStream(...)`.

## Finding
- React Native's global `fetch` (XHR-based) has no streaming `response.body`. The app passes `fetch` from `expo/fetch` (`utils/streamingFetch`). On web, `expo/fetch` is `globalThis.fetch`.
- Hermes has no Web Streams. Expo 54's Metro serializer adds `expo/virtual/streams.js` as a native-only polyfill. This is web-streams-polyfill 4.1.0, and it sets `ReadableStream`, `TransformStream` and `WritableStream` before any module runs (`@expo/cli/build/src/start/server/metro/withMetroMultiPlatform.js`). The winter runtime adds `TextDecoder`, `TextDecoderStream`, `TextEncoderStream`, `URL`, `structuredClone` and `Symbol.asyncIterator`.
- `expo/fetch` builds its body with the global `ReadableStream` at runtime, and Expo's `TextDecoderStream` extends the global `TransformStream` lazily. Streams only pipe into streams of the same implementation, so all three must come from one source. `TRPCProvider` installs all three from the app's `web-streams-polyfill` only when one is missing. Under Expo 54 that block is a no-op on native and on web.
- Verified only on Node (a real `httpBatchStreamLink` client against the production `responseMeta`). Not verified on Hermes or a device.

## Implications
- Do not replace Expo's injected stream globals piecemeal (for example assigning only `ReadableStream` from another polyfill). Mixing implementations breaks `pipeThrough` / `pipeTo` brand checks. The app's own `web-streams-polyfill` dependency is only a fallback for bundles without Expo's injection.
- Removing `rn-eventsource-reborn` changed the native module set, so dev clients and the next native build need a rebuild.

## Related
- [[2026-10-07-decision-sponsor-chat-streaming-jsonl-mutation]] — the feature that relies on this
