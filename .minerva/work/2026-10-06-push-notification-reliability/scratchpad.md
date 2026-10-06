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

## Work notes
- Scheduling + retry share one pure evaluator (`schedule/timing.mts` `isSchedulePending`), and `cron/notify` passes `now` into `listPending`, so a separate scheduling commit would not typecheck on its own. Also, the epic PRs are squash-merged, which makes commit isolation moot anyway. Revert path for the scheduling semantics: revert `timing.mts` + `listPending.mts`. (Routine: the mitigation was a nice-to-have from the scope review, not a criterion.)
- Bug found: `import { type Context }` in cron/notify.mts keeps a side-effect import of context.mts under strip-types/verbatim syntax, which pulls config and crashes tests. Switched to `import type`.
- Bug found: the old `pushToken.upsert` used `update: {}`, so a re-registered revoked token stayed revoked forever. Now it un-revokes.
- Old `getCurrentMinuteOfDayInTimezone` used `hour12: false`, which can render midnight as "24". The new code uses `hourCycle: "h23"` plus `% 24`.
- `datasource/expo/notify.mts` now chunks by index itself (Expo.pushNotificationChunkSizeLimit), so alignment does not depend on the SDK's chunker.
- knip: pre-existing unused exports elsewhere. timing.mts helpers are un-exported except the ones the tests use.
