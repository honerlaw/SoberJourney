import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import Constants from "expo-constants"
import {
  createPushTokenLifecycle,
  type PushTokenLifecycleDeps,
} from "./pushTokenLifecycle"

/**
 * The app's single source for notification permission and this device's push
 * token. Nothing else should call expo-notifications' permission or token APIs.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export type PermissionState = {
  status: Notifications.PermissionStatus
  canAskAgain: boolean
}

/**
 * Push reminders need a physical iOS/Android device. Web is excluded: the
 * server only sends through Expo push, which does not deliver to browsers, and
 * the app has no VAPID / service worker setup.
 */
export function isPushSupported(): boolean {
  return Platform.OS !== "web" && Device.isDevice
}

/** Read the OS permission. Never prompts. */
export async function readPermission(): Promise<PermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync()
  return { status, canAskAgain }
}

/**
 * Show the OS permission prompt if it can still be shown. Only call this from
 * a user action (toggle on, "Allow notifications").
 */
export async function requestPermission(): Promise<PermissionState> {
  // Android 13+ only shows the prompt once a notification channel exists.
  await ensureAndroidChannel()
  const current = await readPermission()
  if (current.status === "granted" || !current.canAskAgain) {
    return current
  }
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync()
  return { status, canAskAgain }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return
  }
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  })
}

async function fetchExpoPushToken(): Promise<string> {
  await ensureAndroidChannel()
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId
  if (!projectId) {
    throw new Error("Project ID not found for notifications")
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data
}

type ServerCalls = Pick<
  PushTokenLifecycleDeps,
  "addPushToken" | "revokePushToken"
>

// Set by usePushTokenSync (inside the tRPC provider); null until then.
let serverCalls: ServerCalls | null = null

export function setPushTokenServerCalls(calls: ServerCalls | null) {
  serverCalls = calls
}

/** The one push-token lifecycle for this app process. */
export const pushTokenLifecycle = createPushTokenLifecycle(() => {
  const calls = serverCalls
  if (!calls || !isPushSupported()) {
    return null
  }
  return {
    ...calls,
    fetchToken: fetchExpoPushToken,
    canFetchTokenForRevoke: async () =>
      (await readPermission()).status === "granted",
  }
})
