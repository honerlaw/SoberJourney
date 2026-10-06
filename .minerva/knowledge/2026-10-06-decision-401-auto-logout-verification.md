# 401 auto-logout verifies the session with Clerk before signing out

**Date**: 2026-10-06
**Type**: decision
**Theme**: app-infrastructure
**Summary**: App logs out on 401 only when Clerk can't mint a token, or after three verified bursts.
**Context**: .minerva/work/2026-10-06-app-infra-auth-errors (see git history if the worktree has been cleaned up)

## Context
Released servers return 401/UNAUTHORIZED only for real auth failures (epic #34 rule 4), and
the app logged out on any 401. A request sent before Clerk had a token (session load) could
trigger a spurious logout, and each mutation 401 logged out twice (default
`mutations.onError` plus `MutationCache.onError`).

## Finding
In `TRPCProvider`, a 401 triggers logout only when Clerk reports `isSignedIn === true`
**and** a forced `getToken({ skipCache: true })` returns no token. The forced check is
shared across a burst of parallel 401s. If Clerk still mints a token (or rejects the refresh
with a Clerk API error), the burst is counted; at 3 counted bursts without an intervening
success the app logs out anyway, so a server-side-deleted user cannot loop forever. A
counted burst that does not log out invalidates errored queries once so screens recover.
Network failures of the check never log out. Queries do not retry deterministic 4xx (all
except 408/429); `QueryCache.onError` still runs the auth handler on the final failure.

## Implications
- Server code must keep 401 meaning "session invalid"; anything else changes logout
  behaviour for every installed client.
- The QueryClient is created once, so its callbacks read handlers and Clerk state through
  refs written in effects; never close over render values there.

## Related
- [[2026-10-06-pattern-session-teardown-endsession]] — what a confirmed logout runs
