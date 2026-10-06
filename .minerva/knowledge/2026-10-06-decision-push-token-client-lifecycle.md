# The app registers its push token on launch and revokes it in endSession; web has no reminders

**Date**: 2026-10-06
**Type**: decision
**Theme**: push-notifications
**Summary**: App registers the push token on launch/sign-in, revokes it before signOut via a latch; web hides reminders.
**Context**: .minerva/work/2026-10-06-push-token-lifecycle (see git history if the worktree has been cleaned up)

## Context
Before #32 the app registered its Expo push token only while a New/Edit Journey screen was
mounted with reminders on, prompted for permission as soon as that screen opened, and never
revoked the token on sign-out. A previous user's sensitive reminders kept arriving on a shared
phone until someone else registered the token, and a rotated token stopped reminders silently.

## Finding
- `hooks/useExpoNotifications/pushPlatform.ts` is the only place that touches
  expo-notifications' permission and token APIs. `isPushSupported()` is false on web and on
  simulators.
- `pushTokenLifecycle.ts` (pure) holds the remembered token, a session **generation** and an
  "ended" **latch**. `revoke()` sets the latch first, so no later `register()` can call
  `addPushToken`, which un-revokes on the server
  ([[2026-10-06-decision-push-token-shared-device-revoke]]). Only `startSession()` clears the
  latch. A `register()` or `revoke()` that outlives its generation makes no further server
  call.
- `usePushTokenSync` runs from `usePushNotifications.native.ts` in `Routes`. On every
  signed-out → signed-in transition or user change (`sessionTransition`, with the last
  `userId` recorded as null while signed out) it calls `startSession()` and registers if
  permission is **already** granted. It retries on foreground and never prompts. It
  registers the revoke as an `endSession` sign-out task
  ([[2026-10-06-pattern-session-teardown-endsession]]); tasks are bounded at 3 s.
- Server calls use `trpc.user.*.mutationOptions().mutationFn` directly, with a
  `MutationFunctionContext`, so a 401 from revoking does not go through MutationCache and
  cannot re-enter the 401 auto-logout handler
  ([[2026-10-06-decision-401-auto-logout-verification]]). This relies on
  `@trpc/tanstack-react-query` 11.8.1 internals; re-check it on upgrade.
- The OS permission prompt appears only from a user action: the reminders toggle, or the
  "Allow notifications" button shown when reminders are on but permission was never asked.
- Web: no VAPID or service worker, and the server only sends through Expo push, which does
  not deliver to browsers. `NotificationSettings` renders nothing on web, but all its hooks
  still run, so editing a journey on web keeps its existing reminder settings.

## Implications
- Revoke coverage: on manual Sign Out it works. On Delete Account the revoke 401s, and the
  server's `user.remove` deletes the tokens. On a 401 auto-logout, or when Clerk drops a
  session without `endSession`, nothing is revoked by the client. Those cases rely on the
  server reassigning the token when the next user registers.
- If `signOut` fails after the revoke, the latch keeps the same user unregistered until the
  next launch or sign-in. This is an accepted cost that errs toward privacy.
- Any signed-in user who has granted permission now has a token registered, even with no
  reminders. The cron only sends for enabled settings.
- Re-enabling web reminders would need web push infrastructure (VAPID, a service worker,
  and a non-Expo sender), not just showing the toggle.
- Never add an early `return null` above the hooks in `NotificationSettings`: on web it would
  save `enabled: false` over existing settings.

## Related
- [[2026-10-06-pattern-session-teardown-endsession]] — the seam the revoke runs in
- [[2026-10-06-decision-push-token-shared-device-revoke]] — why a late register would un-revoke
- [[2026-10-06-constraint-app-provider-order]] — why the sync hook lives in Routes
