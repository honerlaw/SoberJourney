# Scratchpad: sponsor-chat-backend

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [user-directed] pre-flight in-flight check + open-issue match: pre-answered by the coordinator brief (user asked to execute #25; unit 001 folded in read-only per user decision "Fold into Wave 1"); not counted as escalations
- [reviewed — clean] scope check: one unit, one PR, no phases (tier: reviewer — not provably small, ~25 files; parallel wave). Skeptic accept; noted-but-dismissed: keep logical commits per section, tell #31 the server side exists, add rule-8 PR line (added as a criterion)
- [panel — 3/3 accept, 3 with fixes] approach: 1B persist user message before generating and keep it on Gemini failure (overrides #25 checkbox; unit 001 position) + 2B in-process per-conversation mutex (tier: panel — existing interface change: sponsorChat failure behaviour seen by released apps, and ambiguity on lock mechanism; parallel wave)
    - fix (proponent/skeptic/arbiter): addMessage is not a $transaction today (findFirst/create/update separate) — reworded; the unit wraps them in one $transaction
    - fix (all): state the #25 checkbox override as a behaviour change with no contract change; name ghost-bubble and duplicate-on-retry consequences; flag for owner review in PR
    - fix (all): define lock critical section (persist user → history read → generate → persist reply) with try/finally; label 2B best-effort; 60s bound relies on enforced Gemini HTTP timeout
    - fix (proponent/arbiter): single-instance assumption as Open Question with revisit trigger (advisory lock if scaled >1 instance)
    - fix (skeptic/arbiter): tests for merge edge cases (trailing USER, window boundary) and mutex release on error
- [reviewed — folded] whole-proposal: Skeptic revise — (1) persisted blocked prompt re-sent every later turn → buildHistory excludes blocked turns; (2) lock wait could exceed ~100s proxy → 20s bounded wait then proceed unserialized; SDK timeout verified total (no retries on generateContent path); (3) remove races in-flight turn → remove takes the lock; (4) remove null → NotFound documented; (5) DBClient $transaction verified + mocked getOrCreate test; (8) list bad-cursor behaviour specified + undefined-input schema test; (6)(7) noted in Open Questions (tier: reviewer — routed provisionally on approach's pending interface clause, approved as drafted; restart check: not stale — approach pick unchanged, no structural scope change, approach folds were write-up/test additions)
- [rechecked — residual folded] whole-proposal: fold-audit accept; residuals folded: criterion reworded to best-effort serialization (20s) + timed-out waiter must not drop the in-flight chain entry (tested); blocked-detection by constant equality + orphan-merge drop stated as intended; RECITATION-as-blocked stated; manual Postgres smoke check for $transaction/advisory lock added to PR criteria
