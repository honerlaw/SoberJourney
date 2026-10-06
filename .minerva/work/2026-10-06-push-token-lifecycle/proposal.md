# Proposal: 2026-10-06-push-token-lifecycle

**Date**: 2026-10-06
**Status**: Shipped (2026-10-06)
**Closes**: #32

## Goal
Fix the app's push-token lifecycle (GitHub issue #32) so reminders reach the right person and
keep working: revoke this device's token on every sign-out path, register/refresh it on launch
and sign-in instead of only when a journey create/edit screen mounts, stop prompting for
notification permission on screen open (prompt only on a user action), consolidate the OS
permission/token logic into one source, and hide reminders on web (no web push). Client-only;
no server or API contract change.

## Why
- Sign-out never revokes the device token, so after user A signs out of a shared phone, A's
  sobriety reminders (journey titles are sensitive) keep arriving on it until someone else
  registers the token (server-side reassignment from #26 covers only that later moment).
- The token is only registered from `useExpoNotifications(enabled)`, which runs only while a
  New/Edit Journey screen is mounted with reminders on. A rotated token (reinstall, restore,
  OS refresh) silently stops reminders until the user happens to open that screen.
- That same hook fires the OS permission prompt as soon as Edit Journey opens for a journey
  with reminders on — a prompt with no user action (App Review / UX problem).
- `NotificationSettings` reads and requests permission itself, duplicating the hook.
- Web: `Device.isDevice` is true on web, so the toggle shows, but there is no VAPID/service
  worker config and the server only sends through Expo push (which does not deliver to web),
  so web reminders can never arrive.

Preconditions (verified on `origin/epic/audit-wave-1`): server `user.revokePushToken` exists
(#27, PR #40) and the `endSession` seam exists (#29, PR #39).

## Approach
Approach A: a generic pre-sign-out task seam in `endSession`, a pure push-token lifecycle
module with injected dependencies, one platform module for permission/token, and a launch-sync
hook mounted from the existing `usePushNotifications()` call in `Routes`.

1. **`hooks/useAuth/endSession.ts`** — add `registerSignOutTask(task: () => Promise<void>): () => void`
   (returns an unregister function; module-private set; the verify script uses the
   unregister functions, so no test-only reset was needed). `queryClient` is typed as
   `Pick<QueryClient, "cancelQueries" | "clear">` so the script can pass a fake. `endSession`
   runs all registered tasks in parallel BEFORE `signOut()`, as one bounded step:
   `Promise.allSettled` raced against a **3 s** timeout, errors swallowed (tasks report their
   own errors). `allSettled` returns as soon as tasks settle, so the bound only costs time when
   a task hangs. Then the existing `signOut` 10 s race and the `finally` cache clear,
   unchanged. `endSession`'s signature and guarantees are unchanged (the knowledge entry
   `2026-10-06-pattern-session-teardown-endsession` reserved exactly this seam). A task that
   outlives the bound keeps running unobserved; it can only revoke the old user's token with
   the old session's credentials, which is harmless.
2. **`hooks/useExpoNotifications/pushTokenLifecycle.ts`** (pure, no Expo/React imports) —
   `createPushTokenLifecycle({ fetchToken, addPushToken, revokePushToken })`, where the three
   deps are read at call time (the hook passes functions that read a ref, so the latest tRPC
   client is always used; the tRPC client is recreated when headers/config change). Methods:
   The lifecycle keeps a **session generation** counter, a remembered token, and an "ended"
   latch.
   - `startSession()`: increments the generation, clears the latch and the remembered token.
     Called by the sync hook on every signed-out → signed-in transition and on every
     signed-in `userId` change. The hook tracks the last observed `userId` in a ref that is
     **set to null whenever Clerk reports signed out** (the effect does not early-return
     before recording it), so the same account signing out and back in without a restart
     always gets a fresh `startSession()`. This transition logic is a pure function
     (`sessionTransition(prevUserId, nextUserId)` → `"start" | "none"`) verified by the tsx
     script.
   - `register()`: no-op while latched; dedupes concurrent calls; fetches the token; **skips the
     server call when the fetched token equals the token already registered in this
     generation** (so a foreground re-run costs no server write); otherwise calls
     `addPushToken` and remembers the token on success if the generation is unchanged — even
     when `revoke()` latched meanwhile, so the waiting revoke reuses it instead of fetching it
     again (review fix). A `revoke()` that lands during the token fetch stops the register
     before `addPushToken`.
   - `revoke()`: captures the current generation, then sets the "ended" latch FIRST (so no
     later `register()` — AppState foreground, permission grant, effect re-run — can re-enable
     the token via `addPushToken`, which un-revokes; knowledge entry
     `2026-10-06-decision-push-token-shared-device-revoke`), waits for any in-flight
     `register()` (its failure ignored), uses the remembered token, else tries `fetchToken()`
     (may fail → nothing to revoke). Before calling `revokePushToken` it re-checks that the
     generation is unchanged: a revoke that straggles past the 3 s bound and outlives the next
     user's `startSession()` makes no server call and touches no state, so it can never revoke
     the new user's registration. It forgets the remembered token whether or not the server
     call succeeded.
   **Accepted cost:** if `signOut` then fails and the same user stays signed in (the UI shows
   "Failed to sign out"), the latch stays until the next launch or sign-in transition, so that
   user gets no reminders on this device until then. Rare, and it errs toward privacy.
3. **`hooks/useExpoNotifications/pushPlatform.ts`** (Expo glue, the single permission/token
   source): `isPushSupported()` (`Platform.OS !== "web" && Device.isDevice`),
   `readPermission()` (`getPermissionsAsync` → `{ status, canAskAgain }`, never prompts),
   `requestPermission()` (prompts only if not granted and `canAskAgain`), Android channel
   setup, and `fetchExpoPushToken()` (projectId from Constants; Android channel first). Moves
   `setNotificationHandler` here (it now runs at app start, via usePushNotifications.native,
   so foreground notifications show from launch). Holds the one module-level lifecycle
   instance. `requestPermission()` creates the Android channel first: Android 13+ shows the
   prompt only once a channel exists (review fix).
4. **`hooks/useExpoNotifications/useExpoNotifications.ts`** — replaced by hooks over that
   module:
   - `usePushTokenSync()`: one effect keyed on Clerk `isLoaded`/`isSignedIn`/`userId`: records
     the observed `userId` (null when signed out); on a `"start"` transition (device supported)
     calls `startSession()`, then, if permission is already granted (read, never prompted;
     `status === "granted"`, which Expo also reports for iOS provisional authorization),
     `register()`. Also re-runs the
     read + `register()` when the app returns to the foreground (covers a launch-time failure
     and permission granted in system settings), throttled to once per 6 h after a successful
     registration (review fix). Server calls go through
     `trpc.user.addPushToken` / `trpc.user.revokePushToken` `mutationOptions().mutationFn`
     invoked directly (verified: in the installed `@trpc/tanstack-react-query` 11.8.1 it is a
     plain async function that does not touch MutationCache, so a 401 from revoking on a dead
     session or after account deletion does not re-enter TRPCProvider's auto-logout handler;
     `mutationFn` is optional in the type, so guarded; the app's @tanstack/react-query types it
     `(variables, context)`, so a real `MutationFunctionContext` built from `useQueryClient()` is
     passed; a comment explains why). A 401 from the sign-out revoke is not reported to Sentry. Read
     through a ref updated in an effect. Registers `lifecycle.revoke` as an `endSession`
     sign-out task on mount, unregisters on unmount (`Routes` lives for the app's lifetime).
   - `useNotificationPermission()`: `{ isSupported, status, canAskAgain, request() }`;
     re-reads on AppState `active`; `request()` prompts (only when called) and on grant calls
     `register()` so reminders work immediately.
5. **`hooks/usePushNotifications/usePushNotifications.native.ts`** — also calls
   `usePushTokenSync()` (web variant stays a no-op), so `app/_layout.tsx` needs at most a
   comment change.
6. **`components/NotificationSettings/NotificationSettings.tsx`** — no direct
   `expo-notifications` import. Uses `useNotificationPermission()`. **All hooks stay above the
   early returns**, so the imperative ref still exposes the loaded settings when the component
   renders nothing: on web/simulators, editing a journey keeps its existing reminder settings
   (an early `return null` before the hooks would send the server default `enabled: false` and
   clobber them). Renders nothing when unsupported (hides reminders on web and simulators —
   simulators were already hidden). Toggle-on calls `request()` and keeps the switch off with
   the existing toast if not granted; when reminders are on but permission is not granted: if
   `canAskAgain`, a short note plus an "Allow notifications" button (prompt only on press),
   else the existing "blocked in device settings" note. No prompt on mount. A pure
   `permissionView(status, canAskAgain)` helper decides which. The component's web-only
   branches (the `WebDateTimeField` time picker) are now unreachable but kept for a future
   web-push enablement. The only old-hook caller is
   `NotificationSettings` (journey pages import only the component/types), so no journey page
   changes.
7. **Account deletion and 401 auto-logout**: on both, the session is already gone (user
   deleted, or token rejected), so the revoke will normally fail fast with 401 outside
   MutationCache and revoke nothing; it is tolerated within the 3 s bound. Deletion is covered
   by `user.remove` deleting the user's tokens; a 401 logout is covered only by the server
   reassigning the token when the next user registers (#26). Likewise if Clerk drops a session
   without `endSession` (the TRPCProvider `userId` safety net only clears the cache), nothing is
   revoked until the next registrant. Recorded in the knowledge entry, together with the
   `mutationFn`-bypasses-MutationCache invariant (verified on `@trpc/tanstack-react-query`
   11.8.1; re-check on upgrade).
   `DeleteAccountButton` and `TRPCProvider` (not owned) are unchanged.
8. **Behaviour change to note in the PR**: the token is now registered for any signed-in user
   who has granted permission, even without reminders (harmless: the cron only sends for
   enabled settings). Web users can no longer see or turn off reminders (they never received
   them). A token rotated while running is re-learned on the next launch/foreground; no
   `addPushTokenListener` (out of scope).
9. **Invariants (panel clarifications)**:
   - The sign-out task reads its server calls through a ref; a missing or not-ready client
     means nothing to revoke (no-op), and it never throws.
   - `revokePushToken` is idempotent and scoped to the caller on the server, so the
     `fetchToken()` fallback for a never-registered token is harmless. The fallback is skipped
     when permission is not granted.
   - The sync effect does nothing (no `startSession()`, no ref update) until Clerk `isLoaded`;
     the last-seen ref stays `undefined` until then.
   - The web variant of `usePushNotifications` registers no sign-out task (web has no tokens).
   - "Unregisters on unmount" is hygiene only; `Routes` lives for the app's lifetime.
   - The latch after a failed `signOut` also blocks `request()`-on-grant registration
     (consistent with the accepted cost); the manual PR steps cover this case.
   - `npx tsx` is run ad hoc (already in the workspace's node_modules); nothing is added to
     any `package.json`.
10. **Verification**: pure logic in `endSession.ts`, `pushTokenLifecycle.ts` and
   `permissionView`; a committed
   `.minerva/work/2026-10-06-push-token-lifecycle/verify-push-lifecycle.ts` run with `npx tsx`.
   Manual iOS/Android/web steps go in the PR body.

Candidates considered:
- **A (recommended)** as above.
- **B**: pass a `revokePushToken` callback into `endSession({ signOut, queryClient, beforeSignOut })`
  from each caller. Requires editing `TRPCProvider` and `DeleteAccountButton`, which this unit
  does not own. Dominated by A on the ownership constraint.
- **C**: A plus persisting the last token in SecureStore so it can be revoked after a cold
  start without re-fetching. Adds storage state and a stale-token case; the launch sync
  already re-learns the token each signed-in launch with permission, and `revoke()` falls back
  to fetching it. Dominated by A.

Criteria: closes every #32 task; stays inside owned files; never blocks or fails sign-out;
no server change; no new npm dependency; verifiable without a test runner.

## Success criteria
- Revoke coverage stated honestly: every sign-out path runs the client revoke through
  `endSession`; it is effective on manual Sign Out (live session). On Delete Account the
  server's `user.remove` deletes the tokens, and on 401 auto-logout (or a session Clerk drops
  without `endSession`) the token is not revoked by this unit: it relies on server
  reassignment when the next user registers (#26). This is recorded in the knowledge entry
  and the PR body.
- `endSession` runs registered sign-out tasks before `signOut()`; a task that throws, rejects
  or hangs never prevents `signOut` and the cache clear; the pre-sign-out step is bounded
  (≤3 s) and does not wait when tasks settle early; concurrent `endSession` calls still share
  one teardown. Verified by the tsx script.
- `pushTokenLifecycle` behaviour verified by the tsx script: register dedupes; revoke uses the
  remembered token, waits for an in-flight register, falls back to `fetchToken`, tolerates
  failures and forgets the token; after `revoke()`, `register()` is a no-op (no
  `addPushToken` call) until `startSession()`; a revoke that resolves after a later
  `startSession()` makes no server call; `register()` with an unchanged token in the same
  generation makes no server call; a `register()` in flight when `startSession()` runs does
  not remember its token; deps are read at call time.
- `sessionTransition` verified by the tsx script: launch signed in (undefined → A) starts; A →
  null → A (same account re-sign-in) starts again; A → A does not; A → B starts. The hook skips the
  transition entirely while Clerk is not loaded.
- On a native device, the token is registered on launch and on sign-in when permission is
  already granted, without any permission prompt (code path: `usePushTokenSync` called from
  `usePushNotifications.native.ts`, which `Routes` calls).
- No permission prompt fires on opening New/Edit Journey: `requestPermissionsAsync` is called
  only inside `pushPlatform.ts`'s `requestPermission()`, which is called only from user actions
  (toggle on / Allow button).
- `NotificationSettings` imports nothing from `expo-notifications`; permission state comes from
  `useNotificationPermission()`; every hook in it runs before any early return.
- On web, `NotificationSettings` renders nothing; the decision (and its consequences) is
  recorded in a new `.minerva/knowledge/2026-10-06-*` entry.
- No server files and no `package.json`/lockfile changes; `user.addPushToken` input unchanged.
- `npm run build` and `npm run test` (server node tests) and server lint stay green;
  `npx expo lint` in packages/app reports no new errors in touched files.

## Open Questions
- None blocking. iOS behaviour of fetching an Expo token without permission (revoke fallback)
  is best-effort and wrapped in try/catch + the 3 s bound.
