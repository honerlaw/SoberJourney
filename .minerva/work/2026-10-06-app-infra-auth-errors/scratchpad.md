# Scratchpad: 2026-10-06-app-infra-auth-errors

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [reviewed — clean] scope check: one unit, one PR, no phases (tier: reviewer — multi-surface so not solo, no panel clause; parallel wave). Skeptic noted: AppLayout is out of the ownership list (unowned; flag in PR), endSession is the hand-off seam to #32, prefer commit-per-concern — adopted as a working convention, not a decision change.
- [panel — 3/3 accept, 3 with fixes] approach: A — in-place fixes + shared `endSession` teardown helper; rejected B (SessionBridge, same behavior, more indirection) and C (userId watcher only; contradicts "clear inside logout()", no #32 seam) (tier: panel — high blast radius doubt: app-wide auth/logout path ships in native builds that roll back slowly; parallel wave)
    - fix (arbiter): endSession cancels queries before clear(); clear and in-flight reset in finally
    - fix (arbiter): state TRPCProvider drops the useAuthHelpers import; non-retried 4xx still reaches QueryCache.onError
    - fix (arbiter): document 401-while-Clerk-mints-token tradeoff → 3 consecutive verified 401s force endSession; dedupe forced getToken
    - fix (arbiter): justify 408/429 retry carve-outs; userId→null watcher skips initial mount
    - fix (arbiter): refs in useToastError written in an effect (React Compiler)
    - fix (arbiter): push hook reads last response on mount; never navigates while Routes renders LoadingView
    - fix (arbiter): Clerk-never-loads policy (15 s → ErrorView with message, keeps waiting) + offline manual steps
    - fix (arbiter): web deep-link manual tests signed in/out; AppLayout conflict check vs #28/#32
    - fix (arbiter): getErrorMessage script cases (malformed JSON, empty array, non-string message, null/undefined), runner node --experimental-strip-types; npm test is server-only
    - fix (arbiter): list ErrorView call sites and confirm their hooks report; non-email 2FA manual step; no plugin re-injects removed infoPlist strings
- [reviewed — clean] whole-proposal (restart): first-wave review discarded as stale — the approach panel's fixes rewrote `## Success criteria`; the stale review had flagged ErrorView-Sentry removal as a regression, which was factually wrong (all 4 page call sites' hooks report) but prompted the explicit single-report rule now in Approach 4. Restarted Skeptic: accept, no panel warranted (handleError/usePushNotifications signatures unchanged; "always toast" is the fix #28 waits for). Noted, not folded: UNAUTHORIZED toast while auto-logout runs (generic text accepted); 401 counter/15 s timer/watcher are beyond #29 text (kept, separate commits); comment on #32/#28 about the call-site move and endSession seam (do at ship); getErrorMessage.ts must use no path aliases for the strip-types run (tier: reviewer — interface-clause doubt passed to the Skeptic; parallel wave restart)

## Work notes
- `getErrorMessage` deliberately never shows a message that parses as JSON but is not a zod issue array (e.g. `[]`, `{}`), even for a user-facing 4xx code — first draft showed `[]` raw; caught by the ad-hoc script.
- `useToastError`'s TRPC check is structural (`name === "TRPCClientError"`, same as tRPC's own `isTRPCClientError`) so the pure file imports nothing and runs under `node --experimental-strip-types`. Script: 18/18 cases pass (output pasted in the PR body).
- `TRPCProvider` sits *outside* its own `QueryClientProvider`, so `hooks/useAuth` (which now calls `useQueryClient`) can't be used there — that is why `endSession` takes the client as an argument. Every other `useAuth()` consumer is inside the provider (index.tsx, UserInfo, DeleteAccountButton, SignOutSection).
- `TRPCProvider`/`ConfigProvider` render above `ToastProvider`, so toasts from there would not show; nothing in this unit toasts from there.
- `ConfigProvider` omits `report` from its effect deps on purpose: `useReportError().report` depends on `useToastController()`, whose identity outside `ToastProvider` is not guaranteed stable → would refetch-loop.
- `SignOutSection`/`DeleteAccountButton` toast logout failures directly (not `handleError`) because `logout()` already reported — keeps the one-report rule.
- Verification: `npm run build` 0, `npm run test` 0 (server: 2/2 pass; app has no tests), server lint 0, `npx expo lint` 0 errors / 3 warnings (all pre-existing in `ConversationDrawerContent/ListHeader.tsx`, #28's file).
