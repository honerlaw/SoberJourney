import type { QueryClient } from "@tanstack/react-query"

type EndSessionParams = {
  /** Clerk's `signOut` from `useAuth()` (`@clerk/clerk-expo`). */
  signOut: () => Promise<unknown>
  /** The app's single QueryClient (created in TRPCProvider). */
  queryClient: QueryClient
}

let inFlight: Promise<void> | null = null

// Clerk's signOut can hang offline; never let that block teardown forever.
const SIGN_OUT_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Sign out timed out")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * The one session-teardown path. Every sign-out (manual sign out, delete
 * account, 401 auto-logout) goes through here so the next user on the device
 * never sees the previous user's cached data.
 *
 * Concurrent calls (e.g. a burst of parallel 401s) share one in-flight
 * teardown. The cache is cleared even when `signOut` throws or times out.
 */
export function endSession({
  signOut,
  queryClient,
}: EndSessionParams): Promise<void> {
  if (inFlight) {
    return inFlight
  }

  inFlight = (async () => {
    try {
      // Seam for #32 (push token lifecycle): revoke this device's push token
      // here, BEFORE signOut, while the auth token is still valid.
      await withTimeout(signOut(), SIGN_OUT_TIMEOUT_MS)
    } finally {
      try {
        await queryClient.cancelQueries()
      } finally {
        queryClient.clear()
        inFlight = null
      }
    }
  })()

  return inFlight
}
