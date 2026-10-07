# Account deletion removes our data first, then deletes the Clerk user on a best-effort basis

**Date**: 2026-10-06
**Type**: decision
**Theme**: api-compatibility
**Summary**: user.remove deletes DB rows first, then Clerk user; Clerk failures are logged, never surfaced
**Context**: .minerva/work/2026-10-06-server-hardening (see git history if the worktree has been cleaned up)

## Context
The app promises to "permanently delete" the account. Previously `user.remove` deleted only the database user and left the Clerk identity behind. Released apps call `user.remove` and then `logout()`, and they expect the response `{ success, user: { id, createdAt } }`.

## Finding
`route/user/remove.mts` works in this order:
1. It deletes the DB user. Cascades remove all user data.
2. It calls `clerkClient.users.deleteUser(authId)`.
   - A Clerk 404 counts as success and is logged at info.
   - Any other Clerk error is logged at `error` and swallowed. The response shape is unchanged.

Deleting Clerk first was rejected: if the DB step then failed, the data would be stranded with no way to sign in and retry.

## Implications
- When Clerk errors, the identity survives. A later sign-in creates a fresh, empty account. Watch the `["rpc","user","remove","clerk"]` error logs.
- Clerk session JWTs are verified locally and live about 60 seconds. A stray request can therefore re-create an empty `User` row (authId and timezone only) through the context upsert within one token lifetime. This was accepted rather than mitigated.

## Related
- [[2026-10-06-pattern-tolerant-server-validation-for-released-apps]] — the compatibility rules that shaped this ordering
