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
