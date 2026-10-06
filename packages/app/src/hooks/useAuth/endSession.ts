import type { QueryClient } from "@tanstack/react-query"

type EndSessionParams = {
  /** Clerk's `signOut` from `useAuth()` (`@clerk/clerk-expo`). */
  signOut: () => Promise<unknown>
  /** The app's single QueryClient (created in TRPCProvider). */
  queryClient: Pick<QueryClient, "cancelQueries" | "clear">
}

/** Work that must run while the session is still valid, e.g. push token revocation. */
export type SignOutTask = () => Promise<void>

let inFlight: Promise<void> | null = null
const signOutTasks = new Set<SignOutTask>()

// Clerk's signOut can hang offline; never let that block teardown forever.
const SIGN_OUT_TIMEOUT_MS = 10_000
// Sign-out tasks are best effort: they may delay sign-out by at most this much.
const SIGN_OUT_TASKS_TIMEOUT_MS = 3_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Sign out timed out")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Register work to run at the start of every session teardown, BEFORE Clerk
 * `signOut()`, while the auth token is still valid. Returns an unregister
 * function.
 *
 * Tasks run in parallel and are best effort: a task that throws, rejects or
 * hangs never prevents the sign-out or the cache clear. Together they may delay
 * sign-out by at most SIGN_OUT_TASKS_TIMEOUT_MS; a task still running after
 * that keeps running unobserved. Tasks report their own errors.
 */
export function registerSignOutTask(task: SignOutTask): () => void {
  signOutTasks.add(task)
  return () => {
    signOutTasks.delete(task)
  }
}

async function runSignOutTasks(): Promise<void> {
  if (signOutTasks.size === 0) {
    return
  }
  const settled = Promise.allSettled(
    // Promise.resolve().then(...) also turns a synchronous throw into a rejection.
    [...signOutTasks].map((task) => Promise.resolve().then(task)),
  )
  await withTimeout(settled, SIGN_OUT_TASKS_TIMEOUT_MS).catch(() => {})
}

/**
 * The one session-teardown path. Every sign-out (manual sign out, delete
 * account, 401 auto-logout) goes through here so the next user on the device
 * never sees the previous user's cached data or reminders.
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
      // Registered tasks (push token revocation, #32) run first, while the auth
      // token is still valid. Bounded and never throws.
      await runSignOutTasks()
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

