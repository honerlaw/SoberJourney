export function usePushNotifications() {
  // Web has no push (no VAPID / service worker; the server sends through Expo
  // push only): no tap handling, no token registration, no sign-out task.
}
