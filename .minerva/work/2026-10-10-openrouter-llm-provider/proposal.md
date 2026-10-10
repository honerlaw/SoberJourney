# Proposal: openrouter-llm-provider

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)

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

## Approach
Shipped as approach A (approach panel 3/3). The change is server-only: released App Store apps call unchanged tRPC procedures.

- **Datasource.** The new `datasource/openrouter/` uses the official `openai` npm SDK (v7) at
  `https://openrouter.ai/api/v1`. `@google/genai` and `datasource/gemini/` are removed.
  - `createClient.mts` builds the client: `timeout` 60_000, `maxRetries` 0, and the `HTTP-Referer` /
    `X-OpenRouter-Title` headers. It returns null without a key.
  - `client.mts` reads `OPENROUTER_API_KEY` and logs a startup warning when the key is absent.
  - `chat` / `chatStream` take `{ system, messages, maxTokens, signal? }` and return
    `ChatResult` (`ok | blocked | truncated`) or throw `LlmError` (`rate_limited | unavailable | unknown`).
- **Request.** The system prompt goes first as a `system` message, followed by `{role: "user"|"assistant", content}`
  history and `max_tokens`. Every request also sends:
  - `reasoning: {effort: "low", exclude: true}`;
  - `model` = `OPENROUTER_MODEL` or `google/gemini-3.8-flash`;
  - `models` = `OPENROUTER_FALLBACK_MODELS` or `["~google/gemini-flash-latest"]` (an empty value means no fallbacks);
  - no `provider` field. OpenRouter's public endpoint metadata has no data-policy fields, so a filter could not be
    verified; privacy settings are account-level.
- **Fallback warning.** A warning is logged when the served `model` is neither the primary nor
  `<primary>-YYYYMMDD`. An alias primary never warns.
- **Outcome mapping.**
  - `stop` with text → ok.
  - `length` → truncated.
  - No finish reason → truncated (never stored).
  - `finish_reason: "error"` → `LlmError("unavailable")`.
  - `content_filter`, or a Gemini blocking `native_finish_reason` → blocked.
  - Content blocks reported as errors are handled wherever they arrive: a thrown error, a 200 body, or a mid-stream
    chunk.
    - 403 + `reasons` (moderation) → SAFETY.
    - `content_policy_violation` (any status) → the provider code.
    - 403 + a Gemini block `provider_code` → that code.
  - Reasons keep their name only for known Gemini codes (SAFETY, PROHIBITED_CONTENT, BLOCKLIST, SPII, RECITATION,
    OTHER). Any other or missing code → SAFETY, which errs toward the crisis-line fallback.
  - A 403 that only names the provider, or a budget limit, → unavailable.
  - Other errors: 429 → rate_limited; 402 (logged as credits exhausted), 403, 408, 5xx, connection/timeout →
    unavailable; anything else → unknown.
- **Streaming.** `chatStream` bounds the whole stream with its own 60s timeout signal, combined with the caller's.
  `openai@7` ends an aborted stream quietly instead of throwing. So after the loop, an aborted signal with no finish
  reason is rethrown: a caller abort as-is, unlogged; the timeout as `LlmError("unavailable")`. A cut-off reply is
  never persisted.
- **Callers.** Everything now goes through `ctx.datasource.openrouter`. `buildHistory` emits OpenAI-shape messages,
  and `buildGeneration` returns `{ messages, system }`. `toRpcError` keys on `LlmError` (rate_limited →
  TOO_MANY_REQUESTS, else "Failed to generate response."). Title generation uses the same request shape.
- **Config.** `OPENROUTER_API_KEY` is optional; an empty value counts as unset. With it missing, the server and cron
  still boot and only Sponsor replies fail. `GEMINI_API_KEY` is removed. The README documents the three env vars.
  Gemini-named comments were updated, including the cost-ceiling comment in `chatRateLimit.mts`.
- **Tests.**
  - Datasource unit tests cover the request shape, every mapping (thrown, 200-body and mid-stream), the fallback
    warning, a missing key, aborts and the timeout. Two tests drive a real `OpenAI` client through a stalling fetch.
  - Route tests changed only in mock and shape renames.
  - A config test covers an empty key and `GEMINI_API_KEY` no longer being read.
- **Rollout (deliberate exception to auto-merge).** The PR is opened without auto-merge. The owner then:
  1. does the privacy review;
  2. creates a key with a spend limit;
  3. sets the key on both DO components (web + cron);
  4. merges;
  5. runs the post-deploy check;
  6. deletes `GEMINI_API_KEY`.
- **Rejected:**
  - `@openrouter/sdk`: high churn, and its retry/error docs are empty.
  - Raw fetch + SSE: more code to own.
  - A provider switch keeping Gemini: contradicts "everything", and OpenRouter's fallbacks cover the resilience it
    would add.

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
   moderation (`reasons`) / Gemini-block-code 403 — thrown, 200-body error, and mid-stream error chunk — →blocked
   (SAFETY, or the known Gemini code; unknown codes → SAFETY); provider-name-only or unmarked 403→unavailable;
   no finish reason→truncated; finish_reason "error"→unavailable; 429→rate_limited; 402/408/502/503/connection→unavailable;
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
