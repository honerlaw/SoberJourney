# Scratchpad: openrouter-llm-provider

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [solo] pre-flight: no collision; adjacent: #62 sponsor-chat-abuse-hardening (merged, same call sites — main fast-forwarded to include it); peer messaging skipped (not authorized); no open issues
- [reviewed — clean] scope check: one unit, one PR (tier: reviewer — rewrite, not additive; parallel wave). Noted, carried into draft: chatRateLimit "Gemini quota" comment, spend cap, no-auto-merge stated as exception, trpcOptions comment
- [panel — 3/3 accept, 3 with fixes] approach: A — openai@7 SDK at OpenRouter baseURL, Gemini removed in same PR; B (@openrouter/sdk), C (raw fetch+SSE), D (provider switch keeping Gemini) rejected (tier: panel — existing env-var contract GEMINI_API_KEY→OPENROUTER_API_KEY consumed by the DO deploy + production-cutover blast radius; parallel wave)
    - fix (arbiter 1 / proponent 1): GEMINI_API_KEY removed from DO only after post-deploy verification
    - fix (arbiter 2 / skeptic 1 / proponent 2): conservative 403 mapping — content_policy_violation (any status) or 403 with moderation/provider metadata → blocked; unmarked 403 → unavailable; tested for thrown/200-body/mid-stream shapes; prompt-side shape unverified in Open Questions
    - fix (arbiter 3 / skeptic 2 / proponent 6): PR body + report state auto-merge intentionally off and why; key on both DO components (web + cron), DO dashboard
    - fix (arbiter 4 / skeptic 3 / proponent 4): warn when response model ≠ requested primary; fallback-alias rationale stated
    - fix (arbiter 5 / proponent 3): data_collection "deny" endpoint-pool risk — resolved by dropping the request-level filter (public endpoint metadata exposes no data policy, so it could not be verified; checked live); stream-level 60s guard added; reasoning sent without require_parameters
    - fix (arbiter 6 / proponent 5): privacy-label check; README documents OPENROUTER_* vars
- [reviewed — clean] whole-proposal (first wave, discarded as stale): accept with concerns (data_collection unverified, parity criterion, auto-merge exception, cost comment)
- [reviewed — folded] whole-proposal (restart): re-reviewed because the approach panel's fixes rewrote ## Success criteria; Skeptic `revise` — folded: Goal no longer claims live parity; OPENROUTER_API_KEY optional (missing key → chat-only failure, not API boot failure) with written trade-off; privacy review is pre-merge owner step 1; blocked-via-fallback loosening documented; criterion 4 reworded (no deleted test / weakened assert); 60s stream cap labelled new behaviour; typed passthrough for models/reasoning; toRpcError location explicit (tier: reviewer — panel clauses already adjudicated by the approach panel; parallel wave restart)
- [rechecked — residual folded] whole-proposal: fold-audit accept; items 1–3, 5–8 addressed, 4 partial (no alert for 402/fallback cost) — folded: Goal wording on blocked loosening, startup warning when key missing, credit-balance item in post-deploy check
- [reviewed — clean] completion verification: Verifier reproduced criteria 1–8 (ship-time parts of 7/8 pending) — accept (tier: reviewer floor; no interface change beyond the approved one)
- [solo] review triage: 7 FIX / 0 SUGGEST / 0 IGNORE (tier: default-solo row — no finding had two defensible dispositions; #2 narrows an approved mapping detail toward the crisis-guidance entry, an edge-case fix within approach A, not a replan)

## Work notes
- openai@7 error shapes (read from node_modules/openai/core/error.js + streaming.js): an HTTP error is `APIError.generate(status, body)` with `.error = body.error` ({code,message,metadata}); a mid-stream SSE chunk carrying `error` throws `new APIError(undefined, data.error)` — status undefined, so the code comes from `err.error.code`. A 200 non-stream body with `error` is returned as a "completion", so `classifyCompletion` checks it.
- `createClient.mts` is split from `client.mts` so tests can build/inspect the client without the top-level `getConfig` (same side-effect trap as the inline-type-import constraint).
- `models` / `reasoning` pass the SDK types because params is built as a variable typed `ChatCompletionCreateParams & OpenRouterFields` (no excess-property check on a non-literal) — no `any` / cast needed.
- OpenRouter reports the dated canonical slug (`google/gemini-3.8-flash-20260902`) as the served `model`; the fallback warning treats `<requested>-<suffix>` as the same model.
- Live endpoint check: `/api/v1/models/google/gemini-3.8-flash/endpoints` exposes no data-policy fields → request-level `data_collection` dropped (could not be verified; risk of zero eligible endpoints).
- Worktree build needs `DATABASE_URL` placeholder for `npm run build` too (prisma generate inside build), not only codegen.

## Review triage 2026-10-10
Code review (local-diff mode, fresh-context subagent; reproduced against the real openai@7 SDK). Minerva audit: no findings.
1. [high] FIX — chatStream: openai@7 ends an aborted stream quietly (no throw), so a timeout or client disconnect returned the partial text as `ok` and the route persisted it. Fixed: after the loop, an aborted signal with no finish reason rethrows (caller abort as-is, timeout → LlmError unavailable). Real-SDK tests added.
2. [medium] FIX — a 403 carrying only `provider_name` (any upstream provider error) became a SAFETY block → crisis-line fallback, masking outages. Narrowed: content_policy_violation (reason = provider_code if any, else SAFETY), 403 + `reasons` (SAFETY), 403 + Gemini-block provider_code; anything else 403 → unavailable. Non-safety codes (OTHER) pass through → neutral fallback; content_filter keeps a native reason.
3. [medium] FIX — `OPENROUTER_API_KEY=""` failed the whole config (boot failure the optional key exists to prevent). Preprocess "" → undefined; tested.
4. [low] FIX — no finish reason with text → `truncated` (never stored as complete); finish_reason "error" → LlmError unavailable.
5. [low] FIX — fallback warning compared by prefix; now only a `-YYYYMMDD` suffix counts as the same model, and an alias primary (`~…`) never warns.
6. [medium] FIX — stream test mocks threw on abort unlike the SDK; mock now ends quietly, plus two tests through a real `OpenAI` client with a stalling fetch.
7. [low] FIX — tests for provider_name-only 403, OTHER codes, served -lite/-preview slugs.
