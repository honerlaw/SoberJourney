# Reminders fire on local-time daily slots; a send belongs to its own local day

**Date**: 2026-10-06
**Type**: decision
**Theme**: push-notifications
**Summary**: Cadence counts from the send's local day, with a 3h late-send grace; first fire is the next slot.
**Context**: .minerva/work/2026-10-06-push-notification-reliability (see git history if the worktree has been cleaned up)

## Context
`listPending` computed the next reminder as `lastSent + interval` (MONTHLY = 30 days) and took the start-of-day offset from the target instant. Several things went wrong as a result: a brand-new schedule fired immediately, a send that ran past midnight skipped a day, DST days were off by an hour, and one invalid user timezone threw inside a single try/catch so nobody got reminders (#26). A review found that the first fix, "nearest slot" attribution, double-sent or skipped a day when the reminder time moved by 12 hours or more.

## Finding
Pure helpers live in `packages/server/src/database/notification/schedule/timing.mts` (`isSchedulePending`):
- A slot is the local date at `minuteOfDay` in the user's IANA timezone. The local-to-instant conversion uses the offset at that local time. A time in the spring-forward gap resolves to just after the gap, and an ambiguous fall-back time resolves to its first occurrence.
- **First send:** the first slot at or after the schedule's `createdAt` (truncated to the minute), for every frequency. There is no immediate fire.
- **Next send:** take the local date of the last send (or the given-up attempt). A send made before the slot time and within 3h after the previous day's slot belongs to the previous day (late send past midnight). Then add 1/7/14 days, or 1 calendar month with the day clamped. Moving the reminder time never double-sends or skips a day.
- Each schedule is evaluated in its own try/catch. A bad timezone is logged and skipped.

## Implications
- MONTHLY clamping drifts (Jan 31 → Feb 28 → Mar 28). This is accepted.
- `minuteOfDay = null` (not produced by current code) uses interval-since-last-send.
- `Intl.DateTimeFormat` with `hour12: false` can render midnight as "24". Use `hourCycle: "h23"`.
- These helpers are deliberately not exported from `schedule/index.mts` (see the wrapped-index constraint).

## Related
- [[2026-10-06-decision-push-cron-attempts-and-lock]] — retries are scoped to these slots
- [[2026-10-06-constraint-context-wraps-database-index-exports]] — why timing.mts is not re-exported
