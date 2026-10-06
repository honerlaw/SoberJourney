# Scratchpad: push-notification-reliability

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [reviewed — clean] scope check: one unit, one PR, no phases (tier: reviewer — multi-file so solo predicate fails; parallel wave). Noted-but-dismissed: keep scheduling change in its own commit (folded as a cheap mitigation), justify retry design (done in Approach 5).
- [reviewed — folded] approach: option A; Skeptic flagged per-row attempt counting for multi-token users, lock lost after tx timeout, un-revoke interaction; folded run-scoped createdAt = one attempt, slot-scoped attempts, assertLockHeld liveness check + $disconnect, documented un-revoke rationale/side-effects, MONTHLY drift, first-send rule (tier: reviewer — not provably small; existing-interface doubt on addPushToken revoke/un-revoke + scheduling semantics passed to Skeptic, answered "not an existing contract"; parallel wave). Rejected: B (session lock breaks behind pooling; retry storms/lost day), C (needs schema owned by #27).
- [rechecked — residual folded] approach: items 1,4,6,7 addressed; residuals of 2 (single point-in-time lock check, TOCTOU) , 3 (DeviceNotRegistered flap wording), 5 (cadence/outage give-up) are documentation-level — folded as text.
- [reviewed — clean] whole-proposal (restart): first-wave review stale because the approach fold rewrote ## Success criteria; re-reviewed merged draft — accept; clarifications folded as text (datasource invalid-token rule, lock wording, 30-row window note, create() callers) (tier: reviewer — not provably small; parallel wave restart).
- [reviewed — clean] completion verification: Verifier reproduced criteria 1-12 and 14 (43/43 tests); 13 (PR body API-contract + Behavior changes) is ship-time only, so it is carried as a hard ship requirement; no criterion named unmet (tier: reviewer floor — diff changes no interface beyond what the proposal approved). The first dispatch returned an empty "Placeholder" hand-back; the same Verifier was asked to finish, which is not a second review.
- [solo] review triage: 9 FIX / 0 SUGGEST / 2 IGNORE (tier: default-solo row — every finding had a writable failure scenario or was doc/test hygiene, and none had two defensible dispositions). Replan-vs-FIX not convened: finding 1 (nearest-slot attribution misfires on time moves of 12h or more) changes only the attribution mechanism. The approach and success criteria are unchanged, and the fix makes the existing criterion hold, so it is not a load-bearing divergence.

## Work notes
- Scheduling + retry share one pure evaluator (`schedule/timing.mts` `isSchedulePending`), and `cron/notify` passes `now` into `listPending`, so a separate scheduling commit would not typecheck on its own. Also, the epic PRs are squash-merged, which makes commit isolation moot anyway. Revert path for the scheduling semantics: revert `timing.mts` + `listPending.mts`. (Routine: the mitigation was a nice-to-have from the scope review, not a criterion.)
- Bug found: `import { type Context }` in cron/notify.mts keeps a side-effect import of context.mts under strip-types/verbatim syntax, which pulls config and crashes tests. Switched to `import type`.
- Bug found: the old `pushToken.upsert` used `update: {}`, so a re-registered revoked token stayed revoked forever. Now it un-revokes.
- Old `getCurrentMinuteOfDayInTimezone` used `hour12: false`, which can render midnight as "24". The new code uses `hourCycle: "h23"` plus `% 24`.
- `datasource/expo/notify.mts` now chunks by index itself (Expo.pushNotificationChunkSizeLimit), so alignment does not depend on the SDK's chunker.
- knip: pre-existing unused exports elsewhere. timing.mts helpers are un-exported except the ones the tests use.

## Review triage 2026-10-06
Local-diff mode (fresh-context subagent; no PR yet). Minerva audit: spec drift only (finding 5).
1. medium timing.mts nearest-slot attribution → FIX: replaced with `getSlotDateForSend` (send's local date, unless a late send crossed midnight within a 3h grace after the previous slot); tests for 12h+ moves both ways plus a weekly time change.
2. low cron exits 0 on failure → FIX: runWithLock returns "ran"|"skipped"|"failed"; cron.mts sets process.exitCode=1 on failed.
3. low concurrent same-token registration race → FIX: pg_advisory_xact_lock(hashtext(token)) inside the upsert transaction.
4. low DST gap resolves before the gap → FIX: zonedTimeToInstant validates candidates; gap → after, fall-back → first occurrence; tests.
5. low proposal drift (single commit, file name expireStalePending) → FIX at promote (proposal rewrite).
6. medium no 12h+ time-change tests → FIX (with 1).
7. low missing tests for expireStalePending/create/DST gap → FIX (records.test.mts, timing tests); cron.mts disconnect → IGNORE (top-level script, not unit-testable without restructuring).
8. low no cron-level mixed-run test → IGNORE (rule covered in timing.test.mts; cron just writes rows).
9. low stale handleError JSDoc → FIX.
10. low invalid-token log claims revoke → FIX: log after revoke with `revoked` flag.
