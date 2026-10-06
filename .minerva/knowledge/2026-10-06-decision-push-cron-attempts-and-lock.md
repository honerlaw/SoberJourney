# Push cron counts failed sends as attempts per run and runs under an advisory lock

**Date**: 2026-10-06
**Type**: decision
**Theme**: push-notifications
**Summary**: Ticket failures are per-run attempts with bounded backoff; one advisory-locked cron run at a time.
**Context**: .minerva/work/2026-10-06-push-notification-reliability (see git history if the worktree has been cleaned up)

## Context
The reminder cron (`packages/server/src/cron.mts`, one-shot process on an external schedule) mapped Expo tickets back to messages by push token, wrote no row for ticket errors, dropped whole runs on one failed chunk and had no protection against overlapping runs. Each of these caused duplicate or endlessly retried reminders (#26). No schema change was allowed (schema owned by #27).

## Finding
- `datasource.expo.notify` returns results aligned 1:1 with its input. It chunks by index itself and sends with `Promise.allSettled`, and an invalid token gets an aligned entry with `error: "InvalidToken"`. `cron/notify.mts` zips results to messages by index.
- Every `UserPushNotification` row written by one run carries `createdAt` = run start. A ticket failure (Expo ticket error or failed chunk) is a row with `status: ERROR, receiptId: null`. It is a failed **attempt**, and one attempt = one distinct `createdAt`, however many tokens the user has. Any other row (PENDING / COMPLETE / receipt ERROR / `ReceiptExpired`) is a **send**.
- A due slot is retried up to 3 attempts, with backoff of 5 then 10 minutes after the previous attempt. Only attempts at or after the slot count. After 3 attempts the slot is given up and the 3rd attempt counts as its send. A run where one token was accepted and another failed counts as sent; the failed token is not retried.
- `cron/run.mts` `runWithLock` takes `pg_try_advisory_xact_lock(hashtext('soberjourney:cron:notifications'))` inside a Prisma interactive transaction (15 min timeout). The work runs on the normal pool. `assertLockHeld()` (a `SELECT 1` on the lock transaction) is checked right before the Expo hand-off. The function returns `"ran" | "skipped" | "failed"`, and `cron.mts` sets a non-zero exit code on `"failed"` and disconnects Prisma in `finally`.
- PENDING rows older than 24h are expired to `ERROR "ReceiptExpired"`. `getReceipts` tolerates per-chunk failures.

## Implications
- The pg pool needs at least 2 connections, because the lock transaction holds one for the whole run.
- Lock loss after the pre-send check, or a crash between Expo accepting a chunk and rows being written, can still re-send once. Both are accepted residual risks.
- Retry evaluation reads the latest 30 rows per schedule (`NOTIFICATION_HISTORY_WINDOW`). An index on `UserPushNotification(scheduleId, createdAt)` / `(status, createdAt)` would help, but needs a migration (#27's bucket).
- The push payload (`cron/messages/checkin.mts`, `data.url`) is read by released apps and must stay unchanged.

## Related
- [[2026-10-06-decision-reminder-slot-semantics]] — the cadence these attempts are scoped to
- [[2026-10-06-decision-push-token-shared-device-revoke]] — the other revoke source
