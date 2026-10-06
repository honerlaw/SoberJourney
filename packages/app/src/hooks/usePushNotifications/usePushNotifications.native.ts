import { useEffect } from "react"
import * as Notifications from "expo-notifications"
import {
  RelativePathString,
  useRootNavigationState,
  useRouter,
} from "expo-router"
import { useAuth } from "@clerk/clerk-expo"
import { useReportError } from "@/src/hooks/useReportError/useReportError"

type NotificationData = {
  url?: string
  [key: string]: unknown
}

const DASHBOARD = "/(auth)/(drawer)/(tabs)/dashboard"

// A tap still pending after this long (user was signed out) is dropped, so it
// is not delivered to a different user who signs in later on a shared device.
const PENDING_TAP_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Navigates to `data.url` when the user taps a notification, including the
 * tap that cold-started the app. Must be called inside ClerkProvider and the
 * root layout (see app/_layout.tsx).
 */
export function usePushNotifications() {
  const router = useRouter()
  const { report } = useReportError()
  const { isLoaded, isSignedIn } = useAuth()
  const navigationKey = useRootNavigationState()?.key
  // Returns the launching response on mount, so a cold-start tap is not missed.
  const lastNotificationResponse = Notifications.useLastNotificationResponse()

  useEffect(() => {
    if (
      !lastNotificationResponse ||
      lastNotificationResponse.actionIdentifier !==
        Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      return
    }

    // Wait until auth is known, the user is signed in and the navigator is
    // mounted. While signed out the tap stays pending (not cleared) and is
    // delivered after sign-in, unless it has gone stale.
    if (!isLoaded || !isSignedIn || !navigationKey) {
      return
    }

    const tappedAt = lastNotificationResponse.notification.date
    if (
      typeof tappedAt === "number" &&
      Date.now() - tappedAt > PENDING_TAP_MAX_AGE_MS
    ) {
      Notifications.clearLastNotificationResponse()
      return
    }

    const data = lastNotificationResponse.notification.request.content
      .data as NotificationData

    if (data?.url && typeof data.url === "string") {
      try {
        // Ensure dashboard is in the navigation stack before navigating to the target URL
        // This guarantees the back button works even when app is opened from notification
        if (!router.canGoBack()) {
          router.replace(DASHBOARD)
        }
        router.push(data.url as RelativePathString)
      } catch (error) {
        // Don't drop the tap silently: report it and leave the user on the
        // dashboard rather than wherever navigation stopped.
        report(error)
        try {
          router.replace(DASHBOARD)
        } catch (fallbackError) {
          report(fallbackError)
        }
      }
    }

    Notifications.clearLastNotificationResponse()
  }, [
    lastNotificationResponse,
    router,
    report,
    isLoaded,
    isSignedIn,
    navigationKey,
  ])
}
