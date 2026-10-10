# Proposal: openrouter-llm-provider

**Date**: 2026-10-10
**Status**: Draft

## Goal
Route every LLM call the server makes — the Sponsor reply (`conversation.sponsorChat` / `retrySponsorChat`),
the streamed reply (`streamSponsorChat`) and conversation-title generation — through OpenRouter instead of the
Google Gemini API, remove `@google/genai` and `datasource/gemini/`, and make the model (plus fallback models) a
deploy-time config change. On the primary path Sponsor behaviour at cutover is intended to stay the same: the
default model is the one the code uses today (`google/gemini-3.8-flash`), with the same LOW thinking level and the
same ok / blocked / truncated outcome handling (with one documented loosening: `blocked` now means every model
in the fallback chain blocked — see Approach). Within this unit, parity is unit-tested against OpenRouter's documented
response shapes only; live parity is **not** a criterion of this unit (no OpenRouter key exists here). The PR
specifies a post-deploy check that the owner runs after merging.

## Why
- Single-vendor fragility already took Sponsor chat down: Google retired `gemini-2.0-flash` (404) (#53), and the
  follow-up hotfix shipped a thinking-level value the replacement model rejected (#55). Today a model change needs a
  code change in Gemini-specific code (`isGemini3OrLater`, `ThinkingLevel`).
- OpenRouter gives one OpenAI-compatible API across providers, model fallbacks (`models: [...]`, tried on any error
  of the primary, including a retired model) and provider routing, so a retirement or outage is absorbed or becomes
  a config change, and trying another model needs no datasource code (its behaviour still needs checking).
- The owner asked to "move to using openrouter for everything".

## Approach (A — approach panel 3/3 accept with fixes)
Server-only change. Released App Store apps talk to unchanged tRPC procedures, so no client or contract work.

**A. New `datasource/openrouter/` on the official `openai` npm SDK (v7) pointed at `https://openrouter.ai/api/v1`;
Gemini removed in the same PR.**
- `client.mts`: `new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL, timeout: 60_000, maxRetries: 0, defaultHeaders: { "HTTP-Referer": "https://soberjourney.app", "X-OpenRouter-Title": "SoberJourney" } })`.
  `maxRetries: 0` keeps today's "no automatic retry" bound (the turn lock is held for the call). The SDK timeout
  may only cover the wait for response headers, so `chatStream` adds a whole-stream bound: its own 60s timeout signal
  combined with the caller's. This is **new behaviour, not parity** (today only Gemini's `httpOptions.timeout` is
  set). It stops a hung stream from holding the turn lock, and a normal 2048-token reply ends well inside it. The
  timeout ends as `LlmError("unavailable")`; a caller abort is rethrown as-is.
  `models` and `reasoning` are not in `openai@7`'s request types, so they are passed through a narrow, typed
  extension of the request params, with no `any`.
  The client is created only when `OPENROUTER_API_KEY` is set (see Config). Without a key, `chat`/`chatStream`
  throw `LlmError("unavailable")` and log an error naming the missing variable; `client.mts` also logs one
  warning at startup when the key is absent, so a merge without the key is visible in the boot logs.
- Provider-neutral surface: `chat(logger, client, { system, messages, maxTokens, signal? })` and
  `chatStream(...)` with the same `ChatResult` (`ok | blocked | truncated`) and an `LlmError` (`kind`:
  `rate_limited | unavailable | unknown`, SDK error kept as `cause`) replacing `GeminiError`. Messages are
  OpenAI-shape `{ role: "user" | "assistant", content }`; the system prompt goes first as a `system` message.
- Every request sends: `model` = `OPENROUTER_MODEL` env or `google/gemini-3.8-flash`; `models` =
  `OPENROUTER_FALLBACK_MODELS` (comma-separated) or `["~google/gemini-flash-latest"]`; `max_tokens`;
  `reasoning: { effort: "low", exclude: true }` (OpenRouter maps effort→Gemini `thinkingLevel` 1:1, so LOW = today;
  `require_parameters` stays unset, so an endpoint that lacks `reasoning` still serves the request).
  - Fallback rationale: a rolling Gemini Flash alias survives the primary's retirement (the #53 failure) and stays
    in the same model family, so the same system prompt (crisis section included) is sent and behaviour stays close,
    but it is a different, moving model, possibly at a different price. Whenever the response's `model` differs
    from the requested primary, the datasource logs a warning naming both, so fallback service is visible.
    OpenRouter also tries the fallback when the primary's content filter fires. So `blocked` now means "every model
    in the chain blocked or refused". A message the primary blocks may instead get a normal reply from the fallback,
    which is written under the same crisis-section prompt. That is a deliberate, documented loosening of
    "blocked" semantics versus today.
  - No request-level data filter (`provider.data_collection` / `zdr`): OpenRouter's public endpoint metadata does
    not expose provider data policies, so a filter could leave no eligible endpoint (chat down at cutover) and can't
    be verified here. Privacy posture at cutover = today's (Google's paid API) plus OpenRouter as intermediary; the
    owner can turn on training opt-out / ZDR account-wide in the OpenRouter dashboard (for gemini-3.8-flash only
    the `google-vertex` endpoints are ZDR — checked live).
- Outcome mapping (keeps `fallbackReplyFor` / crisis-guidance semantics):
  - `finish_reason: "stop"` + text → `ok`; `"length"` → `truncated` (incl. empty content when reasoning ate the
    budget); empty `ok` → `LlmError("unknown")` as today.
  - `finish_reason: "content_filter"`, or `native_finish_reason` in Gemini's blocking set
    (SAFETY / PROHIBITED_CONTENT / BLOCKLIST / SPII / RECITATION) → `blocked`, reason = the native reason when it is
    in that set, else `"SAFETY"`.
  - Content blocks reported as errors (Gemini's SAFETY filter on OpenRouter is an error: `error_type`
    `content_policy_violation`, HTTP 403 — or a 200 body / mid-stream chunk `error` with `code: 403`). Conservative
    rule, independent of where the error arrives (thrown `APIError`, 200 body, mid-stream chunk): an error whose
    `metadata.error_type` is `content_policy_violation` (any status), or a 403 carrying `metadata.reasons`
    (OpenRouter moderation), `metadata.provider_name` or `metadata.provider_code` (a provider-side block) →
    `blocked`, reason = `metadata.provider_code` when it is a Gemini blocking reason, else `"SAFETY"` (so the user
    gets `SAFETY_FALLBACK_REPLY` with its conditional crisis line, as today). A 403 with none of those markers
    (e.g. a key budget limit) → `unavailable`.
  - Other errors → `LlmError`: 429 → `rate_limited`; 402 (credits) → `unavailable`, logged with its own message so
    an empty balance is visible; 408, 5xx, 502, 503, connection/timeout errors → `unavailable`; 400/401/404/other →
    `unknown`. A streamed error arrives as an `APIError` with `status === undefined`, so the code is read from
    `err.error.code`; the non-streaming path also checks `body.error` on HTTP 200.
- Callers: `ctx.datasource.gemini` → `ctx.datasource.openrouter` (context.mts wiring unchanged in shape);
  `buildHistory` emits `{ role: "user" | "assistant", content }` (the DB→history mapping stays USER/MODEL);
  `buildGeneration` returns `{ messages, system }`; `toRpcError` keys on `LlmError`; generateTitle passes its system
  prompt the same way. tRPC procedures, inputs, outputs and error codes are untouched.
- Config: `OPENROUTER_API_KEY` is **optional** in `util/config.mts` (`z.string().min(1).optional()`), and
  `GEMINI_API_KEY` is removed. Trade-off: today's LLM key is fail-fast (required), but `getConfig` validates the
  whole env and every released app depends on this server. A required key that was forgotten would stop the entire
  API (and cron) from booting. An optional key limits the damage to "Sponsor chat replies fail with the existing
  'Failed to generate response.' error, and the user's message is kept", plus an error log line per call. The PR is
  still held (see Rollout), so the tolerant config is a backstop, not the plan. `OPENROUTER_MODEL` / `OPENROUTER_FALLBACK_MODELS` optional, read in the datasource (as `GEMINI_MODEL` is
  today). README "AI" line names OpenRouter and documents the three env vars.
- Gemini-named comments elsewhere follow: `chatRateLimit.mts` ("hard cost ceiling remains the Gemini project
  quota" → the OpenRouter credit balance / key limit), `trpcOptions.mts`, `fallback.mts`, `buildHistory.mts`,
  `utils/types.mts`, `runStreamSponsorChat.mts`.
- Tests: datasource unit tests rewritten for an OpenAI-shape client mock (chat + stream, every mapping above,
  request shape, fallback-model warning, stream timeout); route tests' mocks renamed; buildHistory tests updated
  for `assistant`/`content`; a config test that the env parses without `OPENROUTER_API_KEY` or `GEMINI_API_KEY`; a
  datasource test that a missing key gives `LlmError("unavailable")`.
- **Rollout (deliberate exception to the owner's auto-merge default).** Merging switches production chat to
  OpenRouter, which needs a key that only the owner can create, and adds a new data processor. The PR is opened
  **without auto-merge**, and the PR body and final report say so up front and why. Owner steps before merge:
  (1) **privacy review**: OpenRouter becomes an intermediary for recovery-support text. Check the app's privacy
  policy and App Store privacy labels, and choose account-level training opt-out / ZDR in the OpenRouter dashboard
  (ZDR pins Gemini to Vertex). (2) Create an OpenRouter key with a credit/spend limit. It replaces the Gemini project
  quota as the hard cost ceiling; the in-process rate limit is per instance, and a fallback model may cost more.
  (3) Set `OPENROUTER_API_KEY` on both DO App Platform components (web + cron) in the DO dashboard (no app spec in
  the repo), and set `OPENROUTER_MODEL` if production set `GEMINI_MODEL`. (4) Merge. After merge: (5) run the
  post-deploy check; (6) only then delete `GEMINI_API_KEY` from DO. Until then, rollback = revert the PR.

**B. `@openrouter/sdk`** — rejected: 416 releases in ~13 months, README retry/error sections are empty placeholders;
`openai@7` is OpenRouter's documented drop-in with mature typed errors and `timeout`/`maxRetries`/`signal`.
**C. Raw `fetch` + hand-rolled SSE** — rejected: re-implements SSE framing, keep-alive comments, `[DONE]`,
mid-stream errors and timeouts; more code to own for no gain.
**D. Provider switch keeping Gemini as a fallback backend** — rejected: contradicts "openrouter for everything",
keeps two code paths and two keys; OpenRouter's `models` fallback covers the resilience D would buy.

## Success criteria
1. `@google/genai` is gone from `packages/server/package.json` and `package-lock.json`; `packages/server/src` has no
   `@google/genai` import and no `datasource/gemini/` directory; `openai` (major 7) is a server dependency.
2. `datasource/openrouter/` exports `chat` and `chatStream`; unit tests assert the client is built with `baseURL`
   `https://openrouter.ai/api/v1`, `timeout` 60_000, `maxRetries` 0 and the two attribution headers, and that each
   request carries `model` (default `google/gemini-3.8-flash`, `OPENROUTER_MODEL` override), `models` (default
   `["~google/gemini-flash-latest"]`, `OPENROUTER_FALLBACK_MODELS` override), `max_tokens`, and
   `reasoning: { effort: "low", exclude: true }`, with no `provider` field.
3. Unit tests cover each outcome mapping for both `chat` and `chatStream`: stop→ok; length→truncated (incl. empty
   content); content_filter and each native Gemini blocking reason→blocked; `content_policy_violation` and
   provider/moderation-marked 403 — thrown, 200-body error, and mid-stream error chunk — →blocked (SAFETY, or the
   Gemini provider_code); unmarked 403→unavailable; 429→rate_limited; 402/408/502/503/connection→unavailable;
   400/401→unknown; empty text→LlmError unknown; caller abort rethrown unlogged; stream exceeding 60s→unavailable;
   a response served by a different model logs a fallback warning.
4. `sponsorChat`, `retrySponsorChat`, `streamSponsorChat` and title generation call `ctx.datasource.openrouter`
   with a system prompt and `{role,content}` messages, and their route tests pass. No existing test case in the
   sponsorChat route tests or `buildHistory` tests is deleted, and no `assert` in them is removed or weakened.
   Changes are limited to mock names, error class names and the history shape (`model`/`parts` →
   `assistant`/`content`). `utils/systemPrompt.mts` is unchanged, so the crisis section keeps its pinned sha256.
5. `util/config.mts` has an optional `OPENROUTER_API_KEY` and no `GEMINI_API_KEY`, and both are asserted by a test.
   A missing key yields `LlmError("unavailable")`, asserted by a test. The README names OpenRouter and documents
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` and `OPENROUTER_FALLBACK_MODELS`.
6. No tRPC procedure's input schema, output shape or error codes change.
   - Under `network/rpc/route/**`, only the sponsorChat directory (including `toRpcError` in `runSponsorChat.mts`)
     and the comment in `conversation/utils/chatRateLimit.mts` change.
   - No router `input(`/`output(` call changes.
7. `npm run build` and `npm test` pass for `packages/server`, and CI is green on the PR.
8. The PR is opened without auto-merge. Its body carries the six owner rollout steps: privacy review, a key with a
   spend limit, the key on both DO components, merge, the post-deploy check, then removing `GEMINI_API_KEY`. It also
   carries the post-deploy check list: craving
   ("I really want to drink right now") → support, no hotline; "I relapsed and I don't want to be here anymore" →
   988; "write me a python script" → warm decline; a streamed reply arrives incrementally (`curl -N`); no fallback
   warning in logs for normal traffic; the OpenRouter credit balance / key-limit usage looks as expected after a day
   (a 402 or key-limit 403 shows up only as `unavailable` errors in the logs).

## Open Questions
- Unverified until live: the exact shape of a prompt-side Gemini block on OpenRouter (docs say content-policy
  errors cover "input or output"; if it arrives as a shape the conservative rule misses, the turn fails with the
  generic "Failed to generate response." error and the user's message is kept, instead of the safety fallback).
  The owner verifies it with the post-deploy check and the logs.
- Privacy outcome: whether the privacy policy or App Store labels need an update. This is the owner's pre-merge
  step (1); this unit changes no policy text.
