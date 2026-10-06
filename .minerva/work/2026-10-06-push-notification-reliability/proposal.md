# Proposal: push-notification-reliability

**Date**: 2026-10-06
**Status**: Shipped (2026-10-06)
**Closes**: #26

## Goal
Make the push-reminder cron reliable: no duplicate sends, no global outage caused by one bad row, no sends to dead or revoked tokens, bounded retries for failed sends, and no overlapping cron runs. Fix the scheduling edge cases listed in #26 and protect released apps on shared devices server-side. Push payload (`title`, `body`, `data` keys/values) stays byte-identical; `user.addPushToken` keeps accepting today's inputs and returning `{ success: true }`.

## Why
GitHub issue #26 (audit epic #34). Today: tickets are mapped back to messages by token, so two schedules sharing a token cause one schedule to re-send every cron run until midnight; one invalid `User.timezone` throws inside a single try/catch and nobody gets reminders; revoked tokens keep receiving sends; ticket errors write no row so they retry every run; `Promise.all` over chunks discards accepted chunks on any failure; overlapping runs double-send; receipts stay PENDING forever; scheduling has off-by-a-day / DST / 30-day-month bugs; a token re-registered by user B on a shared device still delivers user A's reminders. Released App Store builds will never get the client-side revoke route (#32), so the shared-device protection must be server-side.

## Approach
What shipped. It is confined to `packages/server/src/cron.mts`, `cron/**`, `database/notification/**` and `datasource/expo/**`, with no Prisma schema or migration changes and no new dependencies.

1. **Ticket→message mapping by index.** `datasource/expo/notify.mts` chunks valid messages by index (`Expo.pushNotificationChunkSizeLimit`) and sends them with `Promise.allSettled`. It returns results aligned 1:1 with its input:
   - an invalid token gets `error: "InvalidToken"`;
   - a rejected chunk gets `error: "ChunkSendFailed"`;
   - accepted chunks keep their tickets.
   `cron/notify.mts` zips results with its messages by index, so two schedules on one token each get their record.
2. **Per-schedule isolation.** `listPending` evaluates each schedule in its own try/catch, so a bad timezone is logged and skipped. The cron also skips any schedule whose message cannot be built.
3. **Revoked and invalid tokens.** `listPending` loads only `revoked: false` tokens, and the cron skips revoked ones defensively. Tokens failing `Expo.isExpoPushToken` are revoked via `pushToken.revoke` and skipped. `user.addPushToken` validation is untouched.
4. **Failed attempts with bounded retry.**
   - Ticket errors and failed chunks write `ERROR` rows with `receiptId: null`. `create()` now accepts a null receipt and an optional `createdAt`. `DeviceNotRegistered` still revokes.
   - All rows of a run share the run's start `createdAt`, so one attempt = one distinct `createdAt`.
   - `schedule/timing.mts` `isSchedulePending` retries a due slot up to 3 attempts, 5 then 10 minutes after the previous attempt. It counts only attempts at or after the slot, then gives up: the 3rd attempt counts as the slot's send. A mixed run counts as sent.
   - `listPending` reads the latest 30 rows per schedule.
5. **Advisory lock.**
   - `cron/run.mts` `runWithLock` takes `pg_try_advisory_xact_lock(hashtext('soberjourney:cron:notifications'))` in a Prisma interactive transaction (15 min timeout), and the work runs on the pool.
   - `assertLockHeld()` (`SELECT 1` on the lock transaction) is checked right before the Expo hand-off, and the send phase is aborted if it fails.
   - It returns `"ran" | "skipped" | "failed"`. `cron.mts` sets `process.exitCode = 1` on failure and calls `$disconnect()` in `finally`.
   - Accepted residual risks: lock loss after the check, and a crash between Expo acceptance and the row writes.
6. **Receipts.** The new `database/notification/expireStalePending.mts` marks PENDING rows older than 24h as `ERROR "ReceiptExpired"`. `getReceipts` handles chunk errors individually, and receipt lookup uses a Map.
7. **Scheduling semantics** (`schedule/timing.mts`, not re-exported from the wrapped index):
   - Slots are local date + `minuteOfDay` in the user's IANA timezone, converted to an instant with the offset at that local time. A time in the DST gap resolves to just after it; an ambiguous fall-back time resolves to its first occurrence.
   - First send is the first slot at or after `createdAt` (truncated to the minute), for every frequency, with no immediate fire.
   - The next send is the send's local date (or the previous day for a late send within 3h after the previous day's slot) + 1/7/14 days, or + 1 calendar month clamped. Moving the reminder time never double-sends or skips a day. This replaced the proposed "nearest slot" attribution after review showed it misfires on time moves of 12h or more.
   - MONTHLY clamp drift is accepted. `minuteOfDay = null` keeps interval-since-last-send.
   - `hourCycle: "h23"` fixes the "24:00" rendering.
8. **Shared-device fix** (`pushToken/upsert.mts`). In one transaction:
   - `pg_advisory_xact_lock(hashtext(token))` serializes concurrent registrations;
   - the same token is revoked for every other user;
   - the upsert uses `update: { revoked: false }`, so re-registration re-enables the token.
   `addPushToken` inputs and outputs are unchanged.
9. **Tests.** 51 node:test cases across `cron/__tests__`, `database/notification/**/__tests__` and `datasource/expo/__tests__`.

Everything landed as one squash-merged change. The planned separate commit for scheduling was dropped, because scheduling and retry share one evaluator. Revert path: `timing.mts` + `listPending.mts`.

## Success criteria
- `cron/notify.mts` maps tickets to messages by array index; a unit test with two schedules sending to the same token in one run asserts a notification row is created for each schedule.
- `listPending` evaluates each schedule in its own try/catch; a unit test with one schedule whose user timezone is invalid asserts the other schedules are still returned.
- `listPending`'s query selects only `revoked: false` push tokens and the cron skips revoked tokens; a unit test asserts it.
- Ticket errors and failed chunks create ERROR rows with null receiptId and all rows of one run share the run's `createdAt`; unit tests cover: retry allowed, backoff not elapsed, give-up after 3 attempts then next slot fires normally, a multi-token failed run counts as ONE attempt, failures from a previous slot do not count against the current slot, mixed success/failure counts as sent.
- `datasource/expo/notify.mts` uses `Promise.allSettled` and returns results aligned to input; a unit test with one failing chunk asserts accepted chunk tickets are kept.
- The cron run is wrapped in a Postgres advisory lock via `$queryRaw` in `cron/run.mts` (no schema change); unit tests assert the run is skipped when the lock is not acquired and that the send phase is aborted when the lock liveness check fails.
- Stale PENDING receipts (>24h) are expired to ERROR (`expireStalePending`); `getReceipts` returns partial results when one chunk fails (unit test).
- Scheduling helpers have unit tests for: no immediate fire for a schedule created after its time, late send after midnight does not skip a day, same-day time change does not double-send, MONTHLY uses calendar months, DST start/end target instant is correct.
- Invalid Expo tokens are revoked by the cron; `user.addPushToken` input schema is untouched.
- `pushToken.upsert` revokes the same token for other users and un-revokes for the registering user (unit test).
- `cron.mts` disconnects the Prisma client in `finally` after the locked run.
- `cron/messages/checkin.mts` is unchanged (payload `data` keys preserved).
- The PR body contains an "API contract: unchanged" line (epic #34 rule 8) and a "Behavior changes" section listing the scheduling-semantics and token-revocation changes.
- `npm run build`, `npm run test`, and server lint pass; no Prisma schema/migration files changed; no new npm dependencies.

## Open Questions
- Indexes that would help, deferred to #27 (the schema owner):
  - `UserPushNotification(scheduleId, createdAt)` and `(status, createdAt)`, for listPending, receipts and expiry;
  - `UserPushToken(token)`, for revoke-by-token.
