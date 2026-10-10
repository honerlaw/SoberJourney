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
