/**
 * Pure push-token lifecycle (no Expo / React imports, so it can be verified
 * with a plain tsx script). The Expo glue lives in pushPlatform.ts.
 *
 * Invariants:
 * - `revoke()` latches the lifecycle as "ended" before doing anything else, so
 *   no later `register()` (foreground, permission grant, effect re-run) can
 *   re-enable the token: the server's `addPushToken` un-revokes it.
 * - Only `startSession()` clears the latch. It is called on every
 *   signed-out -> signed-in transition and every user change.
 * - Every session has a generation. A `register()` or `revoke()` that outlives
 *   its generation (e.g. a revoke that straggles past endSession's bound while
 *   the next user signs in) makes no further server call and changes no state.
 */

export type PushTokenLifecycleDeps = {
  /** This device's Expo push token. May throw (no permission, offline, ...). */
  fetchToken: () => Promise<string>
  /**
   * Whether `revoke()` may fetch the token when none is remembered (skipped
   * when notification permission is not granted).
   */
  canFetchTokenForRevoke: () => Promise<boolean>
  addPushToken: (token: string) => Promise<unknown>
  revokePushToken: (token: string) => Promise<unknown>
}

export type PushTokenLifecycle = {
  startSession: () => void
  register: () => Promise<void>
  revoke: () => Promise<void>
}

/**
 * `deps` is read at call time, so the caller can swap in the latest tRPC
 * client (TRPCProvider recreates it when headers or config change).
 */
export function createPushTokenLifecycle(
  getDeps: () => PushTokenLifecycleDeps | null,
): PushTokenLifecycle {
  let generation = 0
  let ended = false
  let registeredToken: string | null = null
  let registering: Promise<void> | null = null

  function startSession() {
    generation += 1
    ended = false
    registeredToken = null
    registering = null
  }

  async function doRegister(gen: number) {
    const deps = getDeps()
    if (!deps) {
      return
    }
    const token = await deps.fetchToken()
    if (ended || gen !== generation) {
      return
    }
    if (token === registeredToken) {
      // Already registered for this session: no server write.
      return
    }
    await deps.addPushToken(token)
    if (gen === generation) {
      // Remembered even if revoke() latched meanwhile: revoke waits for this
      // register and then revokes this token without fetching it again.
      registeredToken = token
    }
  }

  function register(): Promise<void> {
    if (ended) {
      return Promise.resolve()
    }
    if (registering) {
      return registering
    }
    const gen = generation
    const current = doRegister(gen).finally(() => {
      if (registering === current) {
        registering = null
      }
    })
    registering = current
    return current
  }

  async function revoke(): Promise<void> {
    const gen = generation
    ended = true
    const pending = registering
    if (pending) {
      await pending.catch(() => {})
    }
    if (gen !== generation) {
      return
    }
    const deps = getDeps()
    if (!deps) {
      return
    }
    let token = registeredToken
    if (
      !token &&
      (await deps.canFetchTokenForRevoke().catch(() => false))
    ) {
      token = await deps.fetchToken().catch(() => null)
    }
    if (gen !== generation) {
      return
    }
    registeredToken = null
    if (!token) {
      return
    }
    await deps.revokePushToken(token)
  }

  return { startSession, register, revoke }
}

/**
 * Decide whether an observed Clerk user is a new session. `prevUserId` is
 * `undefined` before the first observation and `null` while signed out, so
 * the same account signing out and back in is a new session.
 */
export function sessionTransition(
  prevUserId: string | null | undefined,
  nextUserId: string | null,
): "start" | "none" {
  if (!nextUserId) {
    return "none"
  }
  return prevUserId === nextUserId ? "none" : "start"
}
