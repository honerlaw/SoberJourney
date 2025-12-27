import { useEffect } from "react"
import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import Constants from "expo-constants"
import { useMutation } from "@tanstack/react-query"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

async function getNotificationPermissionStatus() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  if (existingStatus === "granted") {
    return existingStatus
  }
  const { status } = await Notifications.requestPermissionsAsync()
  return status
}

export function useExpoNotifications() {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { mutateAsync: addPushToken } = useMutation(
    trpc.user.addPushToken.mutationOptions(),
  )

  useEffect(() => {
    async function init() {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        })
      }

      if (!Device.isDevice) {
        report(new Error("Must use physical device for push notifications"))
        return
      }

      const status = await getNotificationPermissionStatus()
      if (status !== "granted") {
        report(
          new Error(
            "Permission not granted to get push token for push notification!",
          ),
        )
        return
      }
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId
      if (!projectId) {
        report(new Error("Project ID not found for notifications"))
        return
      }
      try {
        const pushTokenString = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data

        await addPushToken({ token: pushTokenString })
      } catch (e: unknown) {
        report(e)
      }
    }

    init()
  }, [report, addPushToken])
}
