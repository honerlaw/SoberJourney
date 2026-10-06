/**
 * What NotificationSettings shows about the OS permission while reminders are
 * on. `status` is null until the first permission read completes.
 * - "ok": granted (or not known yet): nothing to show
 * - "ask": not granted but the OS prompt can still be shown: offer a button
 * - "blocked": denied for good: point the user at system settings
 */
export type PermissionView = "ok" | "ask" | "blocked"

export function permissionView(
  status: string | null,
  canAskAgain: boolean,
): PermissionView {
  if (status === null || status === "granted") {
    return "ok"
  }
  return canAskAgain ? "ask" : "blocked"
}
