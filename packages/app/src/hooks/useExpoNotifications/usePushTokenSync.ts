import { useEffect, useRef } from "react"
import { AppState } from "react-native"
import { useAuth } from "@clerk/clerk-expo"
import { useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { registerSignOutTask } from "@/src/hooks/useAuth/endSession"
import {
  isPushSupported,
  pushTokenLifecycle,
  readPermission,
  setPushTokenServerCalls,
} from "./pushPlatform"
import { sessionTransition } from "./pushTokenLifecycle"

/**
 * Keeps this device's push token registered for the signed-in user and revokes
 * it on sign-out (#32). Call once, from `Routes` (inside Clerk and tRPC; see
 * usePushNotifications.native.ts).
 *
 * - On launch, on every sign-in and when the app returns to the foreground,
 *   registers the token if notification permission is ALREADY granted. It
 *   never prompts; prompting happens only from NotificationSettings.
 * - Registers a sign-out task so endSession revokes the token before Clerk
 *   signs out, while the auth token is still valid.
 */
export function usePushTokenSync() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { report } = useReportError()
  const { isLoaded, isSignedIn, userId } = useAuth()

  const reportRef = useRef(report)
  useEffect(() => {
    reportRef.current = report
  }, [report])

  // Server calls go through mutationOptions().mutationFn directly instead of
  // useMutation: that skips the MutationCache, so a 401 from revoking on a dead
  // session (401 logout, deleted account) cannot re-enter TRPCProvider's
  // auto-logout handler. Verified on @trpc/tanstack-react-query 11.8.1.
  useEffect(() => {
    const addOptions = trpc.user.addPushToken.mutationOptions()
    const revokeOptions = trpc.user.revokePushToken.mutationOptions()
    const add = addOptions.mutationFn
    const revoke = revokeOptions.mutationFn
    if (!add || !revoke) {
      setPushTokenServerCalls(null)
      return
    }
    setPushTokenServerCalls({
      addPushToken: (token) =>
        add(
          { token },
          {
            client: queryClient,
            meta: undefined,
            mutationKey: addOptions.mutationKey,
          },
        ),
      revokePushToken: (token) =>
        revoke(
          { token },
          {
            client: queryClient,
            meta: undefined,
            mutationKey: revokeOptions.mutationKey,
          },
        ),
    })
    return () => setPushTokenServerCalls(null)
  }, [trpc, queryClient])

  useEffect(() => {
    if (!isPushSupported()) {
      return
    }
    return registerSignOutTask(async () => {
      try {
        await pushTokenLifecycle.revoke()
      } catch (err) {
        // A 401 is expected after account deletion or on a dead session; the
        // server covers those cases, so only unexpected failures are reported.
        if (!isUnauthorized(err)) {
          reportRef.current(err)
        }
      }
    })
  }, [])

  // Last observed Clerk user: undefined before Clerk loads, null while signed
  // out, so the same account signing out and back in is a new session.
  const lastUserIdRef = useRef<string | null | undefined>(undefined)
  // When this session last registered successfully (0 = not yet).
  const lastRegisteredAtRef = useRef(0)

  useEffect(() => {
    if (!isLoaded) {
      return
    }
    const nextUserId = isSignedIn && userId ? userId : null
    const transition = sessionTransition(lastUserIdRef.current, nextUserId)
    lastUserIdRef.current = nextUserId
    if (transition !== "start" || !isPushSupported()) {
      return
    }
    pushTokenLifecycle.startSession()
    lastRegisteredAtRef.current = 0
    void registerIfPermitted(reportRef.current).then((ok) => {
      if (ok) lastRegisteredAtRef.current = Date.now()
    })
  }, [isLoaded, isSignedIn, userId])

  // Foreground: retry a failed launch registration, pick up a permission
  // granted in system settings, and re-learn a rotated token. Throttled so a
  // healthy session does not hit Expo / the server on every app switch.
  useEffect(() => {
    if (!isPushSupported()) {
      return
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (
        state !== "active" ||
        !lastUserIdRef.current ||
        Date.now() - lastRegisteredAtRef.current < FOREGROUND_REFRESH_MS
      ) {
        return
      }
      void registerIfPermitted(reportRef.current).then((ok) => {
        if (ok) lastRegisteredAtRef.current = Date.now()
      })
    })
    return () => subscription.remove()
  }, [])
}

// After a successful registration, foreground re-checks wait this long.
const FOREGROUND_REFRESH_MS = 6 * 60 * 60 * 1000

/** Registers if permission is already granted; resolves true on success. */
async function registerIfPermitted(
  report: (err: unknown) => void,
): Promise<boolean> {
  try {
    const { status } = await readPermission()
    if (status !== "granted") {
      return false
    }
    await pushTokenLifecycle.register()
    return true
  } catch (err) {
    report(err)
    return false
  }
}

function isUnauthorized(err: unknown): boolean {
  const data = (err as { data?: { code?: unknown; httpStatus?: unknown } })
    ?.data
  return data?.code === "UNAUTHORIZED" || data?.httpStatus === 401
}
