# Scratchpad: sponsor-chat-abuse-hardening

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [solo] pre-flight: no in-flight collision (no open PRs; no in-flight units; chat-related remote branches all merged; peer messaging skipped — not authorized); no open issues → no issue match
- [reviewed — clean] scope check: one unit, one PR (tier: reviewer — not provably small, ~10 files; no panel clause; parallel wave). Skeptic noted content concerns (guard narrowness/false positives, per-instance limiter, stream stop handling, recovery writing over-refusal) — carried into the approach/whole-proposal folds, not scope-bearing
- [panel — 3/3 accept, 3 with fixes] approach: B — prompt hardening + prompt-data delimiting + fence guard + per-user rate limit (tier: panel — knowledge-tension doubt: TOO_MANY_REQUESTS vs tolerant-validation pattern, scope rules/guard vs crisis-guidance decision; parallel wave). Rejected: A prompt-only (no deterministic backstop), C LLM pre-classifier (latency/cost, injectable, crisis-suppression risk)
    - fix (all): "Compatibility with the released-app rules" subsection — quota ≠ input validation; TOO_MANY_REQUESTS already in USER_FACING_CODES and emitted on Gemini 429; never UNAUTHORIZED
    - fix (skeptic/arbiter): fence guard made crisis-safe — fenced reply with a crisis marker keeps its prose (fence stripped) instead of OFF_TOPIC_REPLY; tests for non-stream and stream
    - fix (all): guard limits stated (fenced code only; prompt is the primary control); split-fence stream test; line-anchored regex
    - fix (all): limiter spec — keyed on authenticated user id, only allowed requests recorded, retry shares it, injectable clock, size-triggered sweep (no timer), per-instance best-effort documented, numbers justified, client never auto-retries mutations (TRPCProvider mutations.retry: false)
    - fix (arbiter): crisis tests unchanged + byte-identical crisis section; eval "write me a script, I really want to drink"
    - fix (arbiter): history behaviour stated — OFF_TOPIC_REPLY NOT added to FALLBACK_REPLIES, so the guarded turn (incl. any distress in the user message) stays in history
    - fix (arbiter): `</message>` tags removed from user text before wrapping in the title prompt
    - fix (arbiter): in-scope list widened (app, programs/meetings/prayers, amends, health/withdrawal/medication); substances rule carves out safety questions
- [reviewed — revise, discarded stale] whole-proposal (first wave): held; folds from approach rewrote Goal/Success criteria → stale. Its points (recovery-content carve-outs, stream result/truncated handling, crisis-in-fence limitation, limiter limits) were folded into the merged draft anyway
- [reviewed — clean] whole-proposal (restart): re-reviewed after approach folds rewrote ## Goal and ## Success criteria (tier: reviewer — knowledge-tension clause already approved at the approach panel, does not re-fire; parallel wave restart). Non-blocking wording applied: goals 1–3 labelled best-effort, broader crisis markers, title calls not counted noted, 100-char title cap called out in API contract

## Work notes 2026-10-10
- Local toolchain in a fresh worktree: `npm ci` at root, then `DATABASE_URL=postgresql://x:x@localhost:5432/x npm run codegen` in packages/server before tests (prisma client is generated into src/generated, gitignored).
- knip run inside `.minerva/worktrees/…` is unreliable (reports 34 unused files incl. server.mts — the worktree path is under a gitignored dir, so knip's gitignore handling drops entries). Compared against the main checkout instead: none of the new exports are flagged; exit 0 both.
- `npx prettier --check` flags `src/datasource/gemini/chat.mts` — pre-existing on main, untouched here.
- Rate limiter is module state: each chat runner test file resets it in a top-level `beforeEach` so existing suites (many turns as user-1) never trip the 20/min limit. node --test runs each file in its own process, so state doesn't leak across files.
- Window boundary: an entry at T0 stops counting at exactly T0 + windowMs (`t > now - windowMs`).
- Stream guard: deltas stop once the accumulated text contains a fence; the stream is consumed to the end (no `return()`/abort), so classification, persistence and lock release are unchanged. A partial "``" from an earlier chunk can leak before `done` replaces it (tested).
- Crisis section hash (sha256 of BASE_SYSTEM_PROMPT from "Crisis resources:") b823fc64…f6cf4 — identical on origin/main and here; asserted in systemPrompt.test.mts.
- Verification: server build OK, tsc OK, lint 0 errors, tests 300/300.
