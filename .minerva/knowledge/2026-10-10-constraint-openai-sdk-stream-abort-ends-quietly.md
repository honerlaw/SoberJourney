# openai@7 streams end quietly on abort, and mid-stream errors carry no HTTP status

**Date**: 2026-10-10
**Type**: constraint
**Theme**: sponsor-chat
**Summary**: Aborted openai@7 streams finish normally; check the signal after iterating; error chunks have status undefined
**Context**: .minerva/work/2026-10-10-openrouter-llm-provider (see git history if the worktree has been cleaned up)

## Context
The OpenRouter datasource streams Sponsor replies through `client.chat.completions.create({stream: true},
{signal})`. The first implementation assumed an aborted stream throws (as the Gemini SDK did), and its unit-test
mocks threw an AbortError on abort, so every test passed. A fresh-context review reproduced the real SDK
against a stalling fetch: the stream simply ended.

## Finding
- In `openai@7` (`core/streaming.js`), when the request signal aborts mid-body (caller abort or
  `AbortSignal.timeout`), the SSE iterator **returns** — the `for await` ends normally with the chunks already
  yielded and nothing is thrown. Code that classifies after the loop therefore sees partial text and no finish
  reason. In `chatStream` that returned `ok` and `runStreamSponsorChat` persisted a cut-off reply on a timeout or
  client disconnect. Fix: after the loop, `if (signal.aborted && !finishReason) throw signal.reason` (caller
  abort rethrown as-is; the timeout becomes `LlmError("unavailable")`); a missing finish reason is classified
  `truncated` as a backstop. A reply whose finish reason arrived before the abort is still kept.
- An SSE chunk carrying `error` makes the SDK throw `new APIError(undefined, data.error)` — `status` is
  `undefined`; the OpenRouter code is in `err.error.code`. An HTTP error is `APIError.generate(status, body)` with
  `err.error = body.error` (`{code, message, metadata}`). A non-streamed HTTP 200 whose body is `{error: …}` is
  returned as if it were a completion, so the caller must check it.
- The SDK's own non-streaming `timeout` does cover the body read (`APIConnectionTimeoutError`).

## Implications
- Never classify a stream's outcome without checking the abort signal: "the loop ended" is not "the response
  finished".
- Stream mocks must mirror the SDK (end on abort), or tests should drive a real `OpenAI` client with a fake
  `fetch` (`datasource/openrouter/__tests__/chatStream.test.mts` "with the real openai SDK") — a mock that throws
  hides this bug.
- Classify errors by `err.status ?? err.error?.code`, never `status` alone.

## Related
- [[2026-10-10-decision-llm-calls-go-through-openrouter]] — the datasource this constrains
- [[2026-10-07-decision-sponsor-chat-streaming-jsonl-mutation]] — the streamed procedure whose "a reply stopped mid-stream is never persisted" rule depends on this
