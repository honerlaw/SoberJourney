# Every app sign-out goes through endSession, which clears the query cache

**Date**: 2026-10-06
**Type**: pattern
**Theme**: app-infrastructure
**Summary**: All app sign-out paths call endSession: signOut, then cancel and clear the QueryClient.
**Context**: .minerva/work/2026-10-06-app-infra-auth-errors (see git history if the worktree has been cleaned up)

## Context
The React Query cache was only reset by the profile Sign Out button. 401 auto-logout and
delete-account signed out without clearing it, so the next user on a shared device briefly
saw the previous user's journeys and journal (issue #29).

## Finding
`packages/app/src/hooks/useAuth/endSession.ts` is the single session-teardown path. It is
used by `useAuth().logout` (and so `SignOutSection` and `DeleteAccountButton`) and by
`TRPCProvider`'s 401 auto-logout. It races Clerk `signOut()` against a 10 s timeout, then
always (in `finally`) `cancelQueries()` + `clear()` on the QueryClient. Concurrent calls
share one module-level in-flight promise, reset in `finally`. As a safety net,
`TRPCProvider` also clears the cache whenever Clerk's `userId` goes from a user to null.

## Implications
- New sign-out entry points must call `useAuth().logout` (or `endSession`), never Clerk
  `signOut` directly.
- Push-token revocation on sign-out (Wave 2, #32) belongs inside `endSession`, before
  `signOut`, while the auth token is still valid — the marked seam.
- `endSession` takes the QueryClient as an argument because `TRPCProvider` cannot call
  `useQueryClient()` (see the provider-order constraint).

## Related
- [[2026-10-06-constraint-app-provider-order]] — why endSession takes the client explicitly
- [[2026-10-06-decision-401-auto-logout-verification]] — the 401 path that calls it
