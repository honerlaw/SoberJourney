import { useCallback, useEffect, useState } from "react"
import { AppState } from "react-native"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import {
  isPushSupported,
  pushTokenLifecycle,
  readPermission,
  requestPermission,
  type PermissionState,
} from "./pushPlatform"

/**
 * Notification permission for UI (NotificationSettings). Reads the permission
 * on mount and whenever the app returns to the foreground, and never prompts
 * by itself: `request()` shows the OS prompt and must only be called from a
 * user action. A grant registers the push token right away.
 */
export function useNotificationPermission() {
  const isSupported = isPushSupported()
  const { report } = useReportError()
  // null until the first read completes
  const [permission, setPermission] = useState<PermissionState | null>(null)

  useEffect(() => {
    if (!isSupported) {
      return
    }
    let cancelled = false
    const check = () => {
      readPermission()
        .then((next) => {
          if (!cancelled) setPermission(next)
        })
        .catch(() => {})
    }
    check()
    // Re-check after the OS prompt closes or the user changes it in settings.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check()
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [isSupported])

  /** Prompt if possible; resolves true when permission is granted. */
  const request = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false
    }
    try {
      const next = await requestPermission()
      setPermission(next)
      if (next.status !== "granted") {
        return false
      }
      pushTokenLifecycle.register().catch(report)
      return true
    } catch (err) {
      report(err)
      return false
    }
  }, [isSupported, report])

  return {
    isSupported,
    status: permission?.status ?? null,
    canAskAgain: permission?.canAskAgain ?? true,
    request,
  }
}
