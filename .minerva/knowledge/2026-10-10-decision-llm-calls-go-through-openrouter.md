# Every server LLM call goes through OpenRouter with the Gemini model kept as default

**Date**: 2026-10-10
**Type**: decision
**Theme**: sponsor-chat
**Summary**: OpenRouter via openai@7 replaces @google/genai; same Gemini model, config fallbacks, optional key, mapped blocks
**Context**: .minerva/work/2026-10-10-openrouter-llm-provider (see git history if the worktree has been cleaned up)

## Context
Sponsor chat called Google's Gemini API directly. Google retiring `gemini-2.0-flash` took chat down (#53),
and the hotfix shipped a thinking level the replacement model rejected (#55); every model change was a code
change in Gemini-specific code. The owner asked to "move to using openrouter for everything".

## Finding
Approach A (approach panel 3/3): `datasource/openrouter/` on the official `openai` npm SDK (v7) at
`https://openrouter.ai/api/v1`; `@google/genai` and `datasource/gemini/` were removed in the same PR.
`@openrouter/sdk` (high churn, empty error/retry docs), a hand-rolled fetch+SSE client, and keeping Gemini
behind a provider switch were rejected.
- Request: system prompt as the first `system` message, `{role: "user"|"assistant", content}` history,
  `max_tokens`, `reasoning: {effort: "low", exclude: true}` (OpenRouter maps effort 1:1 to Gemini
  `thinkingLevel`, so LOW as before), `model` = `OPENROUTER_MODEL` or `google/gemini-3.8-flash`, `models` =
  `OPENROUTER_FALLBACK_MODELS` or `["~google/gemini-flash-latest"]` (empty value = no fallbacks). Client:
  `timeout` 60s, `maxRetries` 0, attribution headers. A reply served by a model other than the primary (the
  dated canonical slug `<primary>-YYYYMMDD` counts as the primary; an alias primary never warns) logs a warning.
- No request-level `provider.data_collection` / `zdr`: OpenRouter's public endpoint metadata exposes no data
  policy, so a filter could leave no eligible endpoint and could not be verified. Training opt-out / ZDR is an
  account-level dashboard choice (ZDR pins gemini-3.8-flash to `google-vertex`).
- Outcomes (feeding `fallbackReplyFor`): `stop`+text → ok; `length` → truncated; **no finish reason** →
  truncated (cut off, never stored); `finish_reason: "error"` → `LlmError("unavailable")`; `content_filter` or
  a Gemini blocking `native_finish_reason` → blocked. Gemini's SAFETY filter arrives on OpenRouter as an
  **error** (`error_type: "content_policy_violation"`, 403; or a 200 body / mid-stream chunk `error`), handled
  wherever it arrives: 403 + `reasons` (OpenRouter moderation) → SAFETY; `content_policy_violation` → the
  provider code; 403 + a Gemini block `provider_code` → that code. Block reasons keep their name only for known
  Gemini codes (SAFETY, PROHIBITED_CONTENT, BLOCKLIST, SPII, RECITATION, OTHER); any other or missing code →
  SAFETY, so an unrecognized block errs toward the reply with the crisis line. A 403 that only names the
  provider, or a key budget limit, is an outage (`unavailable`), not a block.
- Errors → `LlmError` (replaces `GeminiError`): 429 → `rate_limited` (still TOO_MANY_REQUESTS); 402 (logged as
  credits exhausted), 403, 408, 5xx, connection/timeout → `unavailable`; others → `unknown`.
- `OPENROUTER_API_KEY` is optional in `util/config.mts` (an empty value counts as unset): a deploy without it
  boots (warning logged at startup) and only Sponsor replies fail, instead of `getConfig`'s whole-env
  validation stopping the API and cron. `GEMINI_API_KEY` is no longer read.
- `chatStream` bounds the whole stream at 60s (new; previously only the HTTP timeout) and treats an abort before
  the finish reason as a cut-off (see the openai@7 constraint entry).
- Shipped without auto-merge: the owner does the privacy review, creates a spend-limited key, sets it on both DO
  components (web + cron), merges, runs the post-deploy check, then deletes `GEMINI_API_KEY`.

## Implications
- `blocked` now means every model in the fallback chain blocked: OpenRouter also tries fallbacks when the
  primary's filter fires, so a message the primary blocks may get a normal reply from the fallback (same system
  prompt, crisis section included).
- The prompt-side Gemini block shape on OpenRouter was not verified before deploy; if it arrives in a shape the
  mapping misses, the turn fails with "Failed to generate response." and the user's message is kept.
- Changing the model is now config, but behaviour (crisis/scope prompts, `reasoning` on non-Gemini models)
  still needs the live checks from the crisis-guidance and scope-guard entries.
- The hard cost ceiling is the OpenRouter key's credit balance / spend limit (comment in `chatRateLimit.mts`).
- An abort does not stop billing on Google providers through OpenRouter.

## Related
- [[2026-10-06-reference-sponsor-chat-backend-surface]] — its Gemini datasource description (`gemini.chat`, `GeminiError`, `GEMINI_MODEL`, Gemini 3 thinking) is replaced by this; its pagination and history-window facts still hold
- [[2026-10-10-constraint-openai-sdk-stream-abort-ends-quietly]] — why `chatStream` checks its signal after the loop
- [[2026-10-06-decision-sponsor-chat-crisis-guidance]] — the fallback replies the block mapping feeds; harmful-content reasons keep the crisis line
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — a failed or cut-off generation still leaves the user's message stored and unanswered
- [[2026-10-10-decision-sponsor-chat-scope-guard-and-rate-limit]] — the rate limiter whose cost-ceiling comment now points at the OpenRouter key
- [[2026-10-06-reference-released-app-compatibility]] — no tRPC contract changed; released apps are unaffected
