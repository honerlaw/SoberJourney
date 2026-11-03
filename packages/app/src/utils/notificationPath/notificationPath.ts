/**
 * Validates the `url` a push notification asks the app to open.
 *
 * expo-router's `router.push` opens absolute URLs (`https:`, `tel:`, custom
 * schemes) outside the app, so a notification URL is only followed when it is
 * a relative in-app path under the signed-in area, `/(auth)/…` (the shape the
 * server's check-in reminders send). Anything else returns null and the
 * caller lands on the dashboard.
 *
 * Kept import-free so it can be checked with plain node
 * (scripts/check-privacy-helpers.mjs); the app has no test runner.
 */

const IN_APP_PREFIX = "/(auth)/"

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export function safeNotificationPath(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith(IN_APP_PREFIX)) {
    return null
  }
  if (url.includes("\\") || CONTROL_CHARS.test(url)) {
    return null
  }

  // Only the path part is checked for a scheme or `..`; the query may hold
  // values such as ISO dates that contain ":".
  const path = url.split(/[?#]/)[0] ?? ""
  if (path.includes(":") || path.split("/").includes("..")) {
    return null
  }

  return url
}
