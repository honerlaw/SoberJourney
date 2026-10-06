# Proposal: 2026-10-06-app-infra-auth-errors

**Date**: 2026-10-06
**Status**: Shipped (2026-10-06)
**Closes**: #29

## Goal
Fix the app-wide infrastructure defects listed in GitHub issue #29: error toasts that never
show, query cache that leaks between users, auth/startup states that misroute or dead-end,
the sign-in and forgot-password flows' broken feedback, dead code, App Review risk strings
and double Sentry reporting — touching only the files issue #29 owns (plus two removals in the
unowned `AppLayout.tsx`), and keeping released App Store builds working against any server
(client-only change; no server/API contract change).

## Why
- `useToastError.handleError` does `JSON.parse(error.message)` on every tRPC error. Only zod
  validation errors are JSON, so every 500 / network / not-found error throws inside the
  callers' `catch`: no toast anywhere in the app plus an unhandled rejection. It also returns
  a fresh closure every render, which drives the sponsor-chat init effect into a render loop
  (folded in from unit 001's replan, item #3); ~10 consumers app-wide depend on its signature.
- The React Query cache is only reset in `SignOutSection`. 401 auto-logout and delete-account
  do not clear it, so the next user on the device briefly sees the previous user's journeys
  and journal — a privacy defect in a sobriety app.
- While Clerk loads, both `Stack.Protected` guards are false, so a web refresh / deep link to
  any route is redirected and the URL is lost.
- An offline launch shows a wordless `ErrorView` with no retry: a dead app.
- Smaller items: NOT_FOUND retried 3x; duplicate `logout()` on 401 mutation errors; requests
  sent without an auth header can trigger a spurious 401 logout; a cold-start notification tap
  navigates before auth is loaded and is dropped if navigation throws; sign-in gives no
  feedback on non-`complete` statuses, shows "Invalid email or password" for every error and
  hardcodes 2FA to `email_code`; forgot-password state bugs; dead code; unused Camera/Photo
  `infoPlist` strings; every error reported to Sentry twice.

## Approach
Approach A: fix each defect in place, with one shared session-teardown helper. Implemented as
one PR with roughly one commit per concern (toasts, session/TRPC, startup states, push, sign-in,
forgot-password, dead code/config, review fixes) so a reviewer can bisect or revert a single concern.

1. **Error toasts** — `hooks/useToastError`:
   - Extract a pure `getErrorMessage(error, fallbackMessage?)` (own file, no React/Expo imports
     beyond a structural tRPC-error check). Order: for a tRPC client error, try
     `JSON.parse(message)` inside try/catch; if it yields a non-empty array whose first item
     has a non-empty string `message`, use it (zod format; old and new servers). Otherwise, for
     tRPC errors whose `data.code` is a user-facing 4xx (`BAD_REQUEST`, `NOT_FOUND`,
     `FORBIDDEN`, `CONFLICT`, `PRECONDITION_FAILED`, `TOO_MANY_REQUESTS`, `PAYLOAD_TOO_LARGE`)
     and a non-empty plain message, use the plain message (epic rule 4: server messages are
     plain strings). Otherwise (500s, `UNAUTHORIZED`, network errors with no `data`, non-tRPC
     errors, null/undefined) use `fallbackMessage`, else a generic text — "Unable to reach
     SoberJourney. Check your connection and try again." for network errors (tRPC error with no
     `data`), "Something went wrong. Please try again." otherwise.
   - `handleError` keeps its exact signature `(error: unknown, fallbackMessage?: string) =>
     void`, always toasts, never throws (body wrapped in try/catch), reports to Sentry once,
     and is referentially stable: `useCallback` with an empty dependency list reading the
     latest `report`/`toast` through refs that are written in an effect (not during render —
     React Compiler is enabled). The hook's return object is memoized.
2. **Session teardown** — new `hooks/useAuth/endSession.ts` exporting
   `endSession({ signOut, queryClient })`: dedupes concurrent calls via a module-level
   in-flight promise (reset in `finally`, so a failed or settled sign-out never blocks a later
   one; the app has exactly one `QueryClient`). It awaits Clerk `signOut()` raced against a
   10 s timeout (a hung offline sign-out can neither block later logouts nor skip the clear),
   and in `finally`
   awaits `queryClient.cancelQueries()` then calls `queryClient.clear()` — so the cache is
   cleared even when `signOut` throws, and in-flight fetches of the previous user are
   cancelled. A clearly-marked comment before `signOut()` is the seam where Wave 2 (#32) adds
   push-token revocation (while the token is still valid). `useAuth().logout` becomes a stable
   callback that calls `endSession` with `useQueryClient()`, preserving its `{ success, error? }`
   result; dead `useAuth.login`/`signup` are removed. `SignOutSection` switches from Clerk
   `signOut` + manual invalidate/reset to `useAuth().logout`; `DeleteAccountButton` keeps
   calling `logout()` (which now clears) and toasts if sign-out fails.
3. **TRPCProvider**:
   - The `useAuthHelpers` (`hooks/useAuth`) dependency is removed. 401 auto-logout calls
     `endSession` with Clerk's `signOut` and the provider's own `queryClient` (it sits outside
     its own `QueryClientProvider`, so it cannot use `useQueryClient`). The handler is read
     through a ref so the once-created `QueryClient` never holds a stale closure.
   - Auto-logout verifies the session first: only when Clerk reports `isSignedIn === true`, and
     a forced `getToken({ skipCache: true })` returns no token. That forced check is deduped
     across the burst of parallel 401s (one shared in-flight promise). Tradeoff, handled
     explicitly: if the server keeps returning 401 while Clerk still mints a token (e.g. user
     deleted server-side, JWT misconfiguration), a counter of consecutive verified-token 401s
     forces `endSession` at 3, so the user is never stuck in an endless 401 loop; any
     successful query/mutation resets the counter. A Clerk API rejection of the forced
     refresh counts like a fresh token; a network failure never logs out. A counted burst
     that does not log out invalidates the errored queries once, so their screens recover
     (queries do not retry 4xx).
   - Remove the default `mutations.onError` (the `MutationCache.onError` already covers it):
     one handler run per 401, plus `endSession`'s in-flight dedupe.
   - Query `retry`: no retry for tRPC errors with `httpStatus` 400–499 except 408 (request
     timeout) and 429 (rate limited), which are transient by definition; this covers
     NOT_FOUND and UNAUTHORIZED. Otherwise up to 3 as today. Not retrying does not skip the
     401 handler: `QueryCache.onError` still fires on the final failure.
   - Safety net: an effect watching Clerk `userId` calls `queryClient.clear()` when it
     transitions from a user id to `null` (a ref holds the previous value, so the initial
     signed-out mount does not clear). Covers sign-out paths that bypass `logout()`.
   - Headers unchanged: `Authorization: Bearer <token>` when a token exists and
     `X-IANA-Time-Zone` always (API compatibility rule 5).
4. **Sentry single-report rule** (fixes double reporting): query errors are reported by the
   query hooks that consume them (every page rendering `ErrorView` — DashboardPage via
   `useJourneyList`, JourneyInfoPage via `useJourneyInfo`/`useCheckIns`, JournalDashboardPage
   via `useJournalList`, JournalEntryInfoPage via `useJournalEntryInfo` — already calls
   `report(error)`; verified); mutation errors are reported by the caller's `handleError`;
   `ConfigProvider` reports its own fetch error; `ErrorView` never reports. `QueryCache`/
   `MutationCache.onError` stay report-free (auth handling only).
5. **Startup states**:
   - `app/_layout.tsx` `Routes` renders `<LoadingView />` until Clerk `isLoaded`, then the
     `Stack` with its guards, so a web refresh / deep link keeps its URL: signed in → the
     requested protected route; signed out → a protected URL redirects to sign-in / landing as
     today. Safe to render a non-navigator first: the root layout already does so, because
     `ConfigProvider` renders `LoadingView` until config loads.
   - Clerk-never-loads policy: if Clerk has not loaded after 15 s, `Routes` shows `ErrorView`
     with a "Having trouble connecting… close and reopen the app" message while it keeps
     waiting; when `isLoaded` arrives, the `Stack` renders normally. No retry button there
     (Clerk has no re-init API and clerk-expo does not retry a failed initial load);
     today the same situation is an infinite spinner on `index.tsx`, so this is strictly better.
   - `ErrorView` gains an optional `onRetry` prop (renders a "Try again" button) and shows a
     default message ("Something went wrong.") when no `message` is passed, so every existing
     call site (including #30's pages, untouched) gets words. It no longer calls
     `useReportError` (rule in 4).
   - `ConfigProvider` reports a fetch error once per failed attempt (reading `report` via a
     ref, no hook-deps suppression), and renders `ErrorView`
     with a connection message and `onRetry` that re-runs the config fetch.
     `/api/app/config` request/response handling is unchanged.
6. **Push cold start** (minimal; #32 reworks this next): move the `usePushNotifications()`
   call from `components/AppLayout` (outside Clerk and the navigator) into `Routes` in
   `app/_layout.tsx`. The native hook reads `useLastNotificationResponse()` (which returns the
   launching response on mount, so a cold-start tap is not missed) and only navigates once
   Clerk `isLoaded && isSignedIn` and `useRootNavigationState()?.key` is set — never while
   `Routes` is still rendering `LoadingView`. While signed out the response stays pending
   (not cleared), so the tap is delivered after sign-in — unless it is older than 10 minutes,
   then it is dropped so it never reaches a different user on a shared device. `data.url` handling is unchanged
   (push `data` keys per epic rule 5). If `router.push(url)` throws, it reports and leaves the
   user on the dashboard instead of dropping the tap silently; the response is cleared after
   the navigation attempt. Signature unchanged (`usePushNotifications()`); web stub unchanged.
7. **Sign-in** (`useSignInForm`): non-`complete` statuses show an inline message (e.g.
   "Additional verification is required…"); errors show the Clerk message
   (`longMessage ?? message`) inline, with "Invalid email or password." only as fallback;
   2FA picks the strategy from `supportedSecondFactors` (prefer `email_code`, then
   `phone_code`, `totp`, `backup_code`), only calls `prepareSecondFactor` for code strategies,
   and the 2FA copy reflects the strategy. Only unexpected (non-Clerk) errors go to Sentry.
8. **Forgot password** (`ForgotPasswordProvider` + pages): `onEmailSubmit` sets step `code`;
   `ForgotPasswordPage` no longer renders `ResetPasswordPage` off a stale `currentStep`; a
   failed reset keeps the form and shows the Clerk error inline (no silent state wipe);
   success calls `setActive({ session: createdSessionId })` when the result is `complete`
   and toasts after it succeeds (if more steps are needed or `setActive` fails, it toasts
   "reset successful, please sign in" and returns to sign-in); the "Sign in" link uses `back()` /
   `replace("/signin")` instead of `push`.
9. **Dead code / config**: delete `hooks/useDismissed` and `providers/LoadingProvider`
   (removing its wrapper from `AppLayout`); fix `useSpeechToText` to join final results with
   a space (kept, not deleted: deleting it would orphan the `expo-speech-recognition`
   dependency and the mic/speech usage strings, and dependency changes are out of bounds for
   this wave of 7 parallel PRs); remove `NSPhotoLibraryUsageDescription` and
   `NSCameraUsageDescription` from `app.json` (checked: no image-picker/camera dependency or
   config plugin in `package.json`, `app.json` or `app.config.ts` re-injects them).

**File ownership.** All touched files are in #29's list except
`components/AppLayout/AppLayout.tsx`, which no bucket owns (checked #24–#33: none lists it, and
#28/#30/#32 do not plan edits there); the edit is limited to removing the `LoadingProvider`
wrapper and the `usePushNotifications()` call, and is called out in the PR. `hooks/useAuth`
and `hooks/usePushNotifications` are #29's in Wave 1 and #32's in Wave 2; the `endSession`
seam is the documented hand-off point to #32. No server, API or dependency change.

Alternatives considered:
- **B — SessionBridge component**: keep a single `useAuth().logout` path by moving the 401
  handler into a child component rendered under `QueryClientProvider` that registers itself
  into a ref the `QueryClient` callbacks call. Same behavior, more indirection and an extra
  component in the provider tree.
- **C — watcher only**: clear the cache only from a Clerk `userId → null` effect. Smallest
  diff, but the issue asks for the clear inside `logout()`, the effect runs after the
  signed-out tree commits, and it gives #32 no teardown seam. (A keeps it as a safety net.)

## Success criteria
- `getErrorMessage` returns: the first zod message for a JSON-array message; the plain message
  for user-facing 4xx tRPC errors; the fallback, else generic text, for 500, `UNAUTHORIZED`,
  network (no `data`), non-tRPC, `null`/`undefined` errors, malformed JSON, an empty array and
  an array whose first item has a non-string `message` — and never throws. Demonstrated by an
  ad-hoc script run with `node --experimental-strip-types` (no dependency added), output
  recorded in the scratchpad and pasted in the PR body, since `packages/app` has no test runner.
- `handleError` keeps the signature `(error: unknown, fallbackMessage?: string) => void`, is a
  `useCallback` with an empty dependency list, writes its refs in an effect, and contains no
  unguarded `JSON.parse`.
- Every logout path (`useAuth().logout`, `SignOutSection`, `DeleteAccountButton`, 401
  auto-logout) goes through `endSession`, which cancels queries and calls `queryClient.clear()`
  in `finally`; `TRPCProvider` also clears on Clerk `userId` transitioning from a user to `null`.
- `TRPCProvider`: imports nothing from `hooks/useAuth` except `endSession`; no default
  `mutations.onError`; query retry returns false for tRPC 4xx other than 408/429;
  auto-logout requires `isSignedIn` and a null forced token (deduped), with the 3-consecutive
  verified-401 fallback; headers sent are identical to today's.
- `ErrorView` has `onRetry`, renders a default message, and does not call `useReportError`;
  `ConfigProvider` reports once per failed attempt and shows a message and a working retry.
- `Routes` renders `LoadingView` until Clerk `isLoaded`, and `ErrorView` with a message after
  15 s without load.
- `usePushNotifications` is called from `Routes` (not `AppLayout`), navigates only when auth
  is loaded, signed in and the root navigation state has a key, does not clear a pending
  response while signed out, and reports instead of silently dropping a tap when `push` throws.
- Sign-in (Approach 7), forgot-password (Approach 8) and dead-code/config (Approach 9) items
  are implemented as described; `useDismissed`, `LoadingProvider`, `useLoading`,
  `useAuth.login`/`signup` no longer exist and nothing imports them; `app.json` no longer
  contains `NSPhotoLibraryUsageDescription` or `NSCameraUsageDescription`.
- `npm run build` (incl. app `tsc --noEmit`) and `npm run test` pass (the latter covers the
  server only); `npx expo lint` in `packages/app` reports no new errors versus the base branch.
- PR body lists concrete manual test steps for iOS, Android and web, including: server 500 and
  offline on a mutation (toast, no unhandled rejection); sign out / delete account / forced
  401 then sign in as another user (no stale data); web refresh + deep link on a protected
  route signed in and signed out; offline launch (signed in and signed out); cold-start
  notification tap; email-code and non-email (TOTP) 2FA sign-in; forgot-password end to end.

## Open Questions
- None blocking. Native verification (cold-start notification taps, offline launch, non-email
  2FA) can only be done by the user on a device/Clerk instance; listed as manual steps.
