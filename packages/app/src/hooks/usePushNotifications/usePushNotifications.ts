import { useEffect } from "react"
import * as Notifications from "expo-notifications"
import { RelativePathString, useRouter } from "expo-router"
import { useReportError } from "@/src/hooks/useReportError/useReportError"

type NotificationData = {
  url?: string
  [key: string]: unknown
}

export function usePushNotifications() {
  const router = useRouter()
  const { report } = useReportError()
  const lastNotificationResponse = Notifications.useLastNotificationResponse()

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.actionIdentifier ===
        Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const data = lastNotificationResponse.notification.request.content
        .data as NotificationData

      if (data?.url && typeof data.url === "string") {
        try {
          // Ensure dashboard is in the navigation stack before navigating to the target URL
          // This guarantees the back button works even when app is opened from notification
          if (!router.canGoBack()) {
            router.replace("/(auth)/(drawer)/(tabs)/dashboard")
          }
          router.push(data.url as RelativePathString)
        } catch (error) {
          report(error)
        } finally {
          Notifications.clearLastNotificationResponse()
        }
      }
    }
  }, [lastNotificationResponse, router, report])
}
