# Registering a push token revokes it for other users and re-enables it for the registrant

**Date**: 2026-10-06
**Type**: decision
**Theme**: push-notifications
**Summary**: pushToken.upsert revokes the token for other users and un-revokes it for the caller.
**Context**: .minerva/work/2026-10-06-push-notification-reliability (see git history if the worktree has been cleaned up)

## Context
An Expo push token identifies a device install. On a shared device, user B registering the token left user A's row active, so A's reminders kept arriving on B's device. Released App Store builds will never call a client revoke route (#32), so the protection had to live on the server. The old upsert also used `update: {}`, so a revoked token stayed revoked forever, even after the same user re-registered it.

## Finding
`database/notification/pushToken/upsert.mts` (only caller: `user.addPushToken`) runs one transaction:
1. `pg_advisory_xact_lock(hashtext(token))`, which serializes concurrent registrations of the same token.
2. Revoke every non-revoked row with this token that belongs to another user.
3. Upsert `(userId, token)` with `update: { revoked: false }`.
The procedure's inputs and outputs are unchanged.

## Implications
- Re-registration un-revokes a token. The app only registers after notification permission is granted and a fresh Expo token is obtained, so the device is live again. A token the cron revoked (`DeviceNotRegistered`, or invalid format) that the app re-registers gets one more send and is revoked again if Expo still reports it dead.
- #32's client-side revoke must account for this: a later `addPushToken` from the same user re-enables the token.
- There is no index on `UserPushToken.token` alone (the unique key leads with `userId`), so the revoke-by-token query scans. That index belongs to the schema owner.

## Related
- [[2026-10-06-decision-push-cron-attempts-and-lock]] — the cron's own revoke paths
