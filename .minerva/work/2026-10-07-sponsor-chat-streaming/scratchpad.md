# Scratchpad: sponsor-chat-streaming

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-07
- [user-directed] pre-flight in-flight check + open-issue match: coordinator brief pre-answered both (user asked to execute #33; old unit 001-sponsor-chat-streaming is superseded, not a collision); peer messaging skipped (not authorized)
- [reviewed — clean] scope check: one unit, one PR, no phases (tier: reviewer — not provably small; parallel wave). Skeptic accepted; noted-not-folded: state that the issue's idempotency-key task is satisfied by design, mark abort=discard as decided, lock hold across stream, shared responseMeta function imported by its test, grep importers before dep removal — all absorbed into the approach fixes
- [panel — 3/3 accept, 3 with fixes] approach: B — streamed mutation `conversation.streamSponsorChat` over httpBatchStreamLink/JSONL; rejected A (SSE two-step: URL logging, reconnect replay) and C (outside tRPC) (tier: panel — genuine-ambiguity doubt: A's text/event-stream edge advantage meant B not strictly dominant; parallel wave)
    - fix (arbiter 1): A-vs-B buffering comparison stated as unverified; later A / text/event-stream fallback stays additive
    - fix (arbiter 2): abort/lock release/skip-if-queued driven by request signal, not generator.return(); signal wakes the blocked channel consumer; channel closed on every exit path; test abort while blocked on the channel
    - fix (arbiter 3): channel semantics stated (unbounded ≤ one reply, no unhandled rejection after consumer gone, lock-wait timeout as sponsorChat, error-propagation criterion)
    - fix (arbiter 4): reply persisted exactly once even if abort races finish; answered wins on classify; Stop works under a buffering edge
    - fix (arbiter 5): fallback keyed on data.code NOT_FOUND + data.path, pinned against real tRPC output; transport failures never auto re-send
    - fix (arbiter 6): gating native smoke test in PR checklist; on failure route native sends via sponsorChat before native release
    - fix (arbiter 7): expo/fetch platform split, maxItems 1, kept polyfills, responseMeta reads info?.accept, vary untouched, jsonl.pingMs evaluated → adopted (5000 ms; read only in the JSONL branch); client idle timeout noted as open question
    - fix (arbiter 8): safety-blocked partial text never persisted or logged; client replaces it
    - fix (arbiter 9): importers grepped (only CustomEventSource/* + TRPCProvider); verify-*.ts convention recorded; HTTP test pins non-JSONL responses identical
- [reviewed — clean] whole-proposal (first wave, discarded as stale): Skeptic accepted (responseMeta gating safe for released apps; refactor must keep persist-then-read order)
- [reviewed — clean] whole-proposal (restart): re-reviewed because the approach fold rewrote ## Success criteria (tier: reviewer; parallel wave restart). Skeptic accepted; non-load-bearing polish applied: abort-after-completion test added to criterion 3, burst-delivery + lost-done verify cases added to criterion 6, expo lint made unconditional in criterion 7, native rebuild release note

## Work notes 2026-10-07
- Server half committed (88a856d). `runSponsorChat` split into startTurn / buildGeneration / finishReply; `generateReply` composes them so sponsorChat + retry tests pass unmodified. 232 server tests green.
- Real-signal check (HTTP test): tRPC Express adapter aborts the procedure `signal` when the client disconnects mid-JSONL-stream (proves abort path end-to-end, not just a mocked signal).
- Ad-hoc e2e (Node, real @trpc/client httpBatchStreamLink + splitLink against an Express router with production responseMeta + jsonl.pingMs): events arrived at 0.03/0.33/0.63/0.93s (incremental), a 6 s idle gap survived via ping, client abort → AbortError on the client and server signal aborted, unknown procedure → TRPCClientError data `{code:"NOT_FOUND", path:"conversation.streamSponsorChat"}` → fallback detector true. Not Hermes: native still needs the device check.
- Deviation (minor): single `utils/streamingFetch` using `expo/fetch` on all platforms instead of a .web platform file — `expo/fetch`'s web build is `globalThis.fetch` (node_modules/expo/src/winter/fetch/fetch.web.ts), so a split adds nothing.
- Fallback detector keys on `data.code === "NOT_FOUND" && data.path === <stream path>` only (panel fix). It also matches the procedure's own pre-save "Conversation not found." — harmless: the fallback `sponsorChat` then fails the same way with nothing saved.
- Streamed sends run through `useMutation({ mutationFn })` so their errors still reach the global MutationCache auth/logout handler.
- `npm uninstall eventsource rn-eventsource-reborn`: lockfile diff removes only those packages (+ `eventsource-parser` and rn-eventsource-reborn's bundled shrinkwrap tree); the router/rpc-websockets hunks are diff alignment noise.
