# Scratchpad: server-hardening

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [user-directed] pre-flight in-flight check + open-issue match: coordinator brief pre-answered (no collision for #27; "(adopting #27)" — execute the issue); base branch epic/audit-wave-1 per user decision
- [reviewed — clean] scope check: one unit, one PR, unphased (tier: reviewer — multi-surface, not provably small; parallel wave). Noted-but-dismissed: per-task commits for revertability; re-grep serverContext + re-run migration diff after rebase
- [reviewed — folded] approach: A (tolerant hardening in place); Skeptic flagged ghost-user re-creation, silent Clerk failure, Dockerfile npm ci only partial, trim/max ordering + journey.update title — folded (tier: reviewer — interface-clause doubt on validation/redirect/remove passed to the Skeptic, answered "no panel"; parallel wave)
- [rechecked — escalated] approach: fold-audit found 3a (ghost-user window claim) partially addressed + new medium concern (addPushToken re-activation vs #26 lifecycle) → panel
- [reviewed — folded] whole-proposal: Skeptic flagged revoked-token re-registration trap (high) + timezone update ambiguity — folded with reactivatePushToken + explicit upsert semantics (tier: reviewer; parallel wave; no restart — approach fold touched only ## Approach)
- [rechecked — escalated] whole-proposal: fold-audit found a new medium concern (redirect destination item 4 vs criterion 5 contradiction) → panel
- [panel — 3/3 accept, 3 with fixes] approach: A, rev2 (tier: panel — fold-audit escalation)
    - fix (arbiter): add alternative F (interactive tx on Prisma directly) and why nested create dominates
    - fix (arbiter): state re-activation can un-revoke delivery-revoked tokens (accepted cost); #26 comment is a pre-merge deliverable
    - fix (arbiter): REDIRECT_APEX_HOSTS named as the knob; Goal/criterion 5 use https://www.<matchedHost>
    - fix (arbiter): criterion 11 gets a checkable assertion; Clerk 404 = success stated in item 2 + criterion 3
- [panel — 3/3 accept, 3 with fixes] whole-proposal: rev2 (tier: panel — fold-audit escalation)
    - fix (arbiter): criterion 11 inspection check named; criterion 6 via resolveLogLevel test
    - fix (arbiter): criteria 4 + 17 state re-activation incl. delivery-revoked rows; #26 comment deliverable with fallback
    - fix (arbiter): one reproducible migration verification command; mapped to "single clean migration"
    - fix (arbiter): criterion 17 lists prescribed value drifts
    - fix (arbiter): criterion 14 = handler unit test + route-order inspection; bare /api out of scope
    - fix (arbiter): criterion 12 test asserts schedule only with settings + entries include; "race-free" → "recovers from the race"
    - fix (arbiter): PR notes for REDIRECT_APEX_HOSTS default and legacy timezone names

## Work notes
- Migration generated with `prisma migrate diff --from-schema <HEAD schema copy> --to-schema prisma/schema --script`; verified on a scratch postgres:15-alpine container (port 55432): `migrate deploy` applied all 25 migrations, then `migrate diff --from-config-datasource` printed "-- This is an empty migration."
