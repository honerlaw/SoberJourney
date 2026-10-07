/**
 * Verification script for issue #32's pure push-token lifecycle modules.
 *
 * packages/app has no unit-test runner, so this stands in for unit tests. Run
 * from the repo root after `npm ci` (tsx is already in the workspace):
 *
 *   npx tsx .minerva/work/2026-10-06-push-token-lifecycle/verify-push-lifecycle.ts
 */
import assert from "node:assert/strict"
import {
  endSession,
  registerSignOutTask,
} from "../../../packages/app/src/hooks/useAuth/endSession"
import {
  createPushTokenLifecycle,
  sessionTransition,
  type PushTokenLifecycleDeps,
} from "../../../packages/app/src/hooks/useExpoNotifications/pushTokenLifecycle"
import { permissionView } from "../../../packages/app/src/components/NotificationSettings/utils/permissionView"

let passed = 0
async function check(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))
function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function fakeQueryClient(log: string[]) {
  return {
    cancelQueries: async () => {
      log.push("cancel")
    },
    clear: () => {
      log.push("clear")
    },
  }
}

async function main() {
  // ------------------------------------------------------------ endSession
  await check("endSession: no tasks -> signOut then clear", async () => {
    const log: string[] = []
    await endSession({
      signOut: async () => log.push("signOut"),
      queryClient: fakeQueryClient(log) as never,
    })
    assert.deepEqual(log, ["signOut", "cancel", "clear"])
  })

  await check("endSession: tasks run before signOut", async () => {
    const log: string[] = []
    const un1 = registerSignOutTask(async () => {
      await tick()
      log.push("task1")
    })
    const un2 = registerSignOutTask(async () => {
      log.push("task2")
    })
    await endSession({
      signOut: async () => log.push("signOut"),
      queryClient: fakeQueryClient(log) as never,
    })
    un1()
    un2()
    assert.deepEqual(log, ["task2", "task1", "signOut", "cancel", "clear"])
  })

  await check("endSession: throwing / rejecting tasks never block sign-out", async () => {
    const log: string[] = []
    const un1 = registerSignOutTask(() => {
      throw new Error("sync throw")
    })
    const un2 = registerSignOutTask(async () => {
      throw new Error("rejection")
    })
    await endSession({
      signOut: async () => log.push("signOut"),
      queryClient: fakeQueryClient(log) as never,
    })
    un1()
    un2()
    assert.deepEqual(log, ["signOut", "cancel", "clear"])
  })

  await check("endSession: settled tasks do not wait for the bound", async () => {
    const un = registerSignOutTask(async () => {})
    const start = Date.now()
    await endSession({
      signOut: async () => {},
      queryClient: fakeQueryClient([]) as never,
    })
    un()
    assert.ok(Date.now() - start < 500, `took ${Date.now() - start} ms`)
  })

  await check("endSession: a hanging task is bounded at ~3 s", async () => {
    const log: string[] = []
    const un = registerSignOutTask(() => new Promise<void>(() => {}))
    const start = Date.now()
    await endSession({
      signOut: async () => log.push("signOut"),
      queryClient: fakeQueryClient(log) as never,
    })
    un()
    const elapsed = Date.now() - start
    assert.ok(elapsed >= 2900 && elapsed < 4000, `took ${elapsed} ms`)
    assert.deepEqual(log, ["signOut", "cancel", "clear"])
  })

  await check("endSession: concurrent calls share one teardown", async () => {
    let tasks = 0
    let signOuts = 0
    const un = registerSignOutTask(async () => {
      tasks++
      await tick()
    })
    const params = {
      signOut: async () => {
        signOuts++
      },
      queryClient: fakeQueryClient([]) as never,
    }
    const a = endSession(params)
    const b = endSession(params)
    assert.equal(a, b)
    await a
    un()
    assert.equal(tasks, 1)
    assert.equal(signOuts, 1)
  })

  await check("endSession: unregistered tasks do not run; signOut failure still clears", async () => {
    const log: string[] = []
    const un = registerSignOutTask(async () => {
      log.push("task")
    })
    un()
    await assert.rejects(
      endSession({
        signOut: async () => {
          throw new Error("signOut failed")
        },
        queryClient: fakeQueryClient(log) as never,
      }),
    )
    assert.deepEqual(log, ["cancel", "clear"])
  })

  // ------------------------------------------------------------ lifecycle
  type Calls = { add: string[]; revoke: string[]; fetch: number }
  function setup(overrides: Partial<PushTokenLifecycleDeps> = {}) {
    const calls: Calls = { add: [], revoke: [], fetch: 0 }
    let token = "tok-1"
    let deps: PushTokenLifecycleDeps | null = {
      fetchToken: async () => {
        calls.fetch++
        return token
      },
      canFetchTokenForRevoke: async () => true,
      addPushToken: async (t) => {
        calls.add.push(t)
      },
      revokePushToken: async (t) => {
        calls.revoke.push(t)
      },
      ...overrides,
    }
    const lifecycle = createPushTokenLifecycle(() => deps)
    return {
      calls,
      lifecycle,
      setToken: (t: string) => {
        token = t
      },
      setDeps: (d: PushTokenLifecycleDeps | null) => {
        deps = d
      },
      getDeps: () => deps!,
    }
  }

  await check("lifecycle: register adds the token; same token again is no server write", async () => {
    const { calls, lifecycle } = setup()
    lifecycle.startSession()
    await lifecycle.register()
    await lifecycle.register()
    assert.deepEqual(calls.add, ["tok-1"])
  })

  await check("lifecycle: a rotated token is registered again", async () => {
    const { calls, lifecycle, setToken } = setup()
    lifecycle.startSession()
    await lifecycle.register()
    setToken("tok-2")
    await lifecycle.register()
    assert.deepEqual(calls.add, ["tok-1", "tok-2"])
  })

  await check("lifecycle: concurrent registers are deduped", async () => {
    const { calls, lifecycle } = setup()
    lifecycle.startSession()
    const a = lifecycle.register()
    const b = lifecycle.register()
    assert.equal(a, b)
    await Promise.all([a, b])
    assert.equal(calls.fetch, 1)
    assert.deepEqual(calls.add, ["tok-1"])
  })

  await check("lifecycle: revoke uses the remembered token and forgets it", async () => {
    const { calls, lifecycle } = setup()
    lifecycle.startSession()
    await lifecycle.register()
    const fetchesBefore = calls.fetch
    await lifecycle.revoke()
    assert.deepEqual(calls.revoke, ["tok-1"])
    assert.equal(calls.fetch, fetchesBefore, "no fetch when remembered")
    // forgotten: a second revoke must fetch (fallback)
    await lifecycle.revoke()
    assert.equal(calls.fetch, fetchesBefore + 1)
  })

  await check("lifecycle: after revoke, register is a no-op until startSession", async () => {
    const { calls, lifecycle } = setup()
    lifecycle.startSession()
    await lifecycle.register()
    await lifecycle.revoke()
    await lifecycle.register()
    await lifecycle.register()
    assert.deepEqual(calls.add, ["tok-1"])
    lifecycle.startSession()
    await lifecycle.register()
    assert.deepEqual(calls.add, ["tok-1", "tok-1"])
  })

  await check("lifecycle: revoke waits for an in-flight register, then revokes", async () => {
    const gate = deferred()
    const { lifecycle: l2, calls: c2 } = setup({
      addPushToken: async (t) => {
        await gate.promise
        c2.add.push(t)
      },
    })
    l2.startSession()
    const reg = l2.register()
    // let the token fetch finish so addPushToken is in flight (gated)
    await tick()
    const rev = l2.revoke()
    await tick()
    assert.deepEqual(c2.revoke, [], "revoke waits")
    gate.resolve()
    await Promise.all([reg, rev])
    assert.deepEqual(c2.add, ["tok-1"])
    assert.deepEqual(c2.revoke, ["tok-1"])
    // the in-flight register's token was remembered: no second Expo fetch
    assert.equal(c2.fetch, 1)
  })

  await check("lifecycle: revoke during the token fetch stops the register before addPushToken", async () => {
    const { calls, lifecycle } = setup()
    lifecycle.startSession()
    const reg = lifecycle.register()
    const rev = lifecycle.revoke()
    await Promise.all([reg, rev])
    assert.deepEqual(calls.add, [], "never re-enabled on the server")
    assert.deepEqual(calls.revoke, ["tok-1"])
  })

  await check("lifecycle: failing in-flight register does not stop revoke", async () => {
    const { calls, lifecycle } = setup({
      addPushToken: async () => {
        throw new Error("offline")
      },
    })
    lifecycle.startSession()
    const reg = lifecycle.register().catch(() => {})
    await lifecycle.revoke()
    await reg
    assert.deepEqual(calls.revoke, ["tok-1"])
  })

  await check("lifecycle: revoke falls back to fetchToken; fetch failure means nothing to revoke", async () => {
    const ok = setup()
    ok.lifecycle.startSession()
    await ok.lifecycle.revoke()
    assert.deepEqual(ok.calls.revoke, ["tok-1"])

    const failing = setup({
      fetchToken: async () => {
        throw new Error("no token")
      },
    })
    failing.lifecycle.startSession()
    await failing.lifecycle.revoke()
    assert.deepEqual(failing.calls.revoke, [])
  })

  await check("lifecycle: revoke skips the fallback fetch without permission", async () => {
    const { calls, lifecycle } = setup({
      canFetchTokenForRevoke: async () => false,
    })
    lifecycle.startSession()
    await lifecycle.revoke()
    assert.equal(calls.fetch, 0)
    assert.deepEqual(calls.revoke, [])
  })

  await check("lifecycle: revokePushToken failure propagates (reported by caller) and still forgets", async () => {
    let fail = true
    const { calls, lifecycle } = setup({
      revokePushToken: async (t) => {
        if (fail) throw new Error("401")
        calls.revoke.push(t)
      },
    })
    lifecycle.startSession()
    await lifecycle.register()
    await assert.rejects(lifecycle.revoke())
    fail = false
    const fetches = calls.fetch
    await lifecycle.revoke()
    assert.equal(calls.fetch, fetches + 1, "token was forgotten")
  })

  await check("lifecycle: a straggling revoke after the next startSession makes no server call", async () => {
    const gate = deferred<string>()
    let first = true
    const { calls, lifecycle } = setup({
      fetchToken: async () => {
        calls.fetch++
        if (first) {
          first = false
          return gate.promise
        }
        return "tok-B"
      },
    })
    lifecycle.startSession()
    // nothing remembered: revoke must fetch, and that fetch hangs
    const rev = lifecycle.revoke()
    await tick()
    // next user signs in and registers while the old revoke is still pending
    lifecycle.startSession()
    await lifecycle.register()
    gate.resolve("tok-B")
    await rev
    assert.deepEqual(calls.revoke, [], "straggler made no server call")
    assert.deepEqual(calls.add, ["tok-B"])
    // and the new session still knows its token (straggler touched no state)
    await lifecycle.register()
    assert.deepEqual(calls.add, ["tok-B"], "dedupe still sees registered token")
  })

  await check("lifecycle: a register in flight across startSession does not remember its token", async () => {
    const gate = deferred()
    let gated = true
    const { calls, lifecycle } = setup({
      addPushToken: async (t) => {
        if (gated) {
          gated = false
          await gate.promise
        }
        calls.add.push(t)
      },
    })
    lifecycle.startSession()
    const reg = lifecycle.register()
    await tick()
    lifecycle.startSession()
    gate.resolve()
    await reg
    // new generation: same token must be registered again (not deduped)
    await lifecycle.register()
    assert.deepEqual(calls.add, ["tok-1", "tok-1"])
  })

  await check("lifecycle: deps are read at call time; missing deps are a no-op", async () => {
    const { calls, lifecycle, setDeps, getDeps } = setup()
    const original = getDeps()
    setDeps(null)
    lifecycle.startSession()
    await lifecycle.register()
    await lifecycle.revoke()
    assert.deepEqual(calls.add, [])
    const added: string[] = []
    setDeps({ ...original, addPushToken: async (t) => void added.push(t) })
    lifecycle.startSession()
    await lifecycle.register()
    assert.deepEqual(added, ["tok-1"], "latest deps used")
    assert.deepEqual(calls.add, [])
  })

  // ------------------------------------------------------------ sessionTransition
  await check("sessionTransition table", () => {
    assert.equal(sessionTransition(undefined, "A"), "start", "launch signed in")
    assert.equal(sessionTransition(undefined, null), "none", "launch signed out")
    assert.equal(sessionTransition("A", null), "none", "sign out")
    assert.equal(sessionTransition(null, "A"), "start", "A -> null -> A re-sign-in")
    assert.equal(sessionTransition("A", "A"), "none", "same session")
    assert.equal(sessionTransition("A", "B"), "start", "user change")
  })

  // ------------------------------------------------------------ permissionView
  await check("permissionView table", () => {
    assert.equal(permissionView(null, true), "ok", "not read yet")
    assert.equal(permissionView("granted", false), "ok")
    assert.equal(permissionView("undetermined", true), "ask")
    assert.equal(permissionView("denied", true), "ask", "Android can re-ask")
    assert.equal(permissionView("denied", false), "blocked")
  })

  console.log(`\n${passed} checks passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
