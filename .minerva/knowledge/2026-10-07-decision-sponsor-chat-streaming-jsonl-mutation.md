# Sponsor replies stream through a new JSONL tRPC mutation that shares the sponsorChat turn and lock

**Date**: 2026-10-07
**Type**: decision
**Theme**: sponsor-chat
**Summary**: conversation.streamSponsorChat streams saved/delta/done over httpBatchStreamLink; abort persists nothing; falls back to sponsorChat
**Context**: .minerva/work/2026-10-07-sponsor-chat-streaming (see git history if the worktree has been cleaned up)

## Context
Issue #33 asked for token-by-token Sponsor replies without touching the procedures released App Store builds call (epic #34). The superseded unit 001 had proposed POST-then-SSE. A 3/3 approach panel weighed (A) a two-step tRPC SSE subscription, (B) a streamed mutation over tRPC v11 JSONL, (C) a hand-rolled Express SSE route.

## Finding
- Chosen: B. `conversation.streamSponsorChat` (new mutation, `sponsorChat`'s `chatInput`) is an async generator streamed as chunked JSONL in one POST. Events: `{type:"saved",userMessageId}` right after the user row is persisted, `{type:"delta",text}` per Gemini chunk, `{type:"done",response,userMessageId,modelMessageId}` after the reply is persisted. `done.response` is authoritative: the client replaces the streamed partial with it (it differs when a safety block turned the reply into `SAFETY_FALLBACK_REPLY` / `BLOCKED_FALLBACK_REPLY`).
- Why not A: SSE input travels in the query string, and `pino-http` / edge logs record URLs, so the message would leak in plaintext. Avoiding that forces two requests. EventSource also auto-reconnects, which needs replay and idempotency. B has neither problem: the text is in the body, mutations never retry, and nothing reconnects on its own. That also meets the issue's "reconnect must never re-send" requirement without an idempotency key.
- Server pipeline: `runSponsorChat.mts` is split into `startTurn` (ownership → persist user row → `onSaved` → read history; options `signal`, `onSaved`), `buildGeneration` and `finishReply` (persists the reply once). `generateReply` composes them, so `sponsorChat` and `retrySponsorChat` behave exactly as before. The stream runs the whole turn inside `withConversationLock` as a producer feeding `utils/eventChannel.mts`; the generator drains the channel.
- Abort is driven by the request `signal`, which tRPC's Express adapter aborts on `res` close; `generator.return()` cannot interrupt a pending await. Behavior by timing:
  - before persisting (including while queued on the lock): nothing happens;
  - during generation: Gemini is aborted, with a check after every chunk, nothing more is persisted, and the user row stays unanswered so Retry covers it;
  - after generation finished: the reply is still persisted exactly once.
- Gemini: `datasource/gemini/chatStream.mts` yields deltas and returns a `ChatResult`, classified at the end via the shared `classifyOutcome` / `classifyError`. An abort is rethrown and not logged as a Gemini error.
- Edge: `network/rpc/streamResponseMeta.mts` adds `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no` only when `info.accept === "application/jsonl"`. `trpcOptions.mts` sets `jsonl.pingMs: 5000`, a whitespace keep-alive that only the JSONL branch reads. Released apps (`httpBatchLink`) never send `trpc-accept`, so their responses are unchanged; an HTTP test pins this.
- Client:
  - `TRPCProvider` routes only `STREAM_PROCEDURE_PATH` to `httpBatchStreamLink` using `expo/fetch`.
  - `ConversationProvider` runs the stream inside `useMutation({ mutationFn })`, so auth errors still reach the global MutationCache handler.
  - The reply renders as a `${clientId}-reply` bubble, the same id the final cached reply gets.
  - Stop aborts the send.
  - Every failure goes through the existing `classifyFailedSend` refetch. A `saved` event forces at least `saved-unanswered`. A failure with no proof of saving and no server error response is re-checked after 1.5 s before the draft is restored.
  - Falls back to `sponsorChat` (with the same abort signal) only on `NOT_FOUND` for the stream path before any event.
- The unused SSE plumbing was removed: `CustomEventSource`, the `httpSubscriptionLink` branch, and the `eventsource` + `rn-eventsource-reborn` dependencies. Retry stays non-streaming.

## Implications
- Incremental delivery through DigitalOcean's edge (DO-managed, Cloudflare-backed) was not verifiable before deploy. If the edge buffers, the reply arrives whole at the end, as before streaming. Verify after deploy with the `curl -N` check in the unit's PR or final report. If the edge buffers, the additive follow-ups are a `text/event-stream` variant or design A.
- Native streaming depends on `expo/fetch` plus Web Streams globals from a single implementation, which Expo 54 injects (see the Hermes constraint entry). Smoke-test on iOS and Android before a native release. If it fails, route native sends through `sponsorChat`, a one-line client change.
- The lock is held for the whole streamed turn, up to the 60 s Gemini timeout. Waiters still give up after 20 s and proceed unserialized, as with `sponsorChat`.
- A streamed Retry would reuse `buildGeneration`/`finishReply` the same way.

## Related
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — the persistence rules the stream keeps
- [[2026-10-06-decision-sponsor-chat-turn-lock]] — the lock held across the stream
- [[2026-10-06-decision-conversation-rename-and-retry-procedures]] — the Retry path that covers stopped or failed streams
- [[2026-10-06-decision-chat-client-paginated-cache-and-failed-sends]] — the failed-send classification reused here
- [[2026-10-06-decision-sponsor-chat-crisis-guidance]] — the fallback text that replaces a blocked partial
- [[2026-10-07-constraint-hermes-streams-for-trpc-jsonl]] — native prerequisites of the stream link
