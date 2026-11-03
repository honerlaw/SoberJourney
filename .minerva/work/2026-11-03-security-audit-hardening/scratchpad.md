# Scratchpad: security-audit-hardening

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-11-03
- [reviewed — folded] scope check: one unit, one PR; folded fingerprint fallback (drop dep bump if fingerprint changes) + diff-size estimate (tier: reviewer — not provably small, spans app/server/deps; parallel wave)
- [rechecked — escalated] scope check: items 2 (revert coupling) and 4 (calibration against released builds, 415 gate) partially addressed → panel
- [panel — 3/3 accept, 3 with fixes] scope check: one unit, one PR, no phases (tier: panel — fold-audit escalation; quorum 3/3)
    - fix (all): rollback story — one commit per control, app commits separate; revert only the server commit; whole-PR revert re-ships the old app; eas update:republish / roll-back-to-embedded; split out a stalled control
    - fix (skeptic/arbiter): numeric limits env-overridable, 0 disables
    - fix (all): git-history released-client calibration evidence written into the proposal (mutation cap, batch cap, 415 gate), retry/rapid-tap and multi-device reasoning
    - fix (all): rejection codes never UNAUTHORIZED/401, no "Token expired"/"Invalid token" messages; criterion for errorFormatter pass-through
    - fix (all): dropped dep bump → GitHub issue + tell user finding 8 stays open; re-run predict after final rebase; verify eas.yml published after merge
    - fix (skeptic/arbiter): review focus adds @clerk/express, mutation limiter, user upsert; confirm dead token branch / EXPO_ACCESS_TOKEN unreachable from clients
    - fix (proponent/arbiter, optional): real tRPC client test against the guard — adopted (criterion 6)
- [panel — 3/3 accept, 3 with fixes] approach: A (tier: panel — existing interface change: new rejections on procedures released apps call; knowledge tension with tolerant-validation pattern; parallel wave)
    - fix: residual wording for findings 4/5/6/9; decrypt budget calibrated on one encrypted field per entry and reserved up front; mutation-limit headroom; batch cap covers GET and POST; single-instance limitation; guard ordering; UNAUTHORIZED pinned through errorFormatter
- [restart] whole-proposal: first-wave review stale — scope fold and approach fixes rewrote Goal and Success criteria; re-selected tier reviewer, re-dispatched against the merged draft
- [reviewed — folded] whole-proposal: folded (1) finding-1 OTA-only reach + existing Sentry data as residual, sendDefaultPii/replay checked; (2) batch cap counts the decoded path (%2C), guard-after-Clerk wording, encoded-comma test; (3) mechanical grep check for criterion 20; (4) real httpBatchLink/httpBatchStreamLink test, no-content-type POST unchanged. Dismissed: (5) stated frame-header scope; (6) adopted via scope fix; (7)(8) stated residual visibility and per-code retry/logout behaviour (tier: reviewer — not provably small; parallel wave)
- [rechecked — clean] whole-proposal: fold-audit confirmed items 1–8 addressed; new low/medium wording points applied in self-review (grep scope excludes tests/comments; TRPC_JSON_ONLY_POSTS kill switch for the 415 gate; dropped bump removes package.json/lockfile changes)
