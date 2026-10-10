#!/usr/bin/env node
/**
 * Fails when a package that expo pins for the installed SDK is locked at a
 * version outside expo's range anywhere in the lockfile — root, workspace-local
 * or nested, transitive included.
 *
 * `expo install --check` and expo-doctor only look at direct dependencies, so a
 * native module pulled in transitively (react-native-svg via
 * @tamagui/lucide-icons) can stay on an old SDK's version and break the native
 * build. That is how SDK 57's iOS build broke on react-native-svg 15.15.1.
 *
 * Limits: only packages listed in expo's bundledNativeModules.json are checked
 * (some of which are JS-only); other transitive native modules are not. The
 * expected ranges come from the installed `expo`, so run it after `npm ci`.
 *
 * It also fails when a package in MUST_BE_HOISTED is not a single root copy.
 *
 * Usage: node scripts/check-native-module-versions.mjs [path/to/package-lock.json]
 */
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const lockfilePath = path.resolve(
  process.argv[2] ?? path.join(appDir, "..", "..", "package-lock.json"),
)

/**
 * Tolerated mismatches, keyed by exact `name@version` (any lockfile path). A
 * different version of a listed package still fails, and so does an entry
 * that no longer matches anything, so a change forces a fresh look.
 */
const ALLOWLIST = {
  // Transitive via @clerk/clerk-expo → @solana-mobile/wallet-*-mobile (^1.17.7).
  // Not imported by the app and not compiled into the iOS build. Remove once
  // the lockfile reaches the 2.x expo expects.
  "@react-native-async-storage/async-storage@1.24.0":
    "unused transitive dependency of Clerk's Solana wallet adapters",
}

/**
 * Packages that must have exactly one lockfile copy, hoisted to the root
 * `node_modules`. `@expo/cli` is nested under `node_modules/expo`, so it can
 * only resolve these from the root; a copy under `packages/app/node_modules`
 * is invisible to it. The root package.json pins each one to the same version
 * as packages/app, so bump both together.
 */
const MUST_BE_HOISTED = {
  // `expo export -p web` (DigitalOcean's build) requires expo-router from
  // @expo/cli and @expo/router-server; un-hoisted, every deploy failed.
  "expo-router": "required by @expo/cli's static web export",
}

function fail(message) {
  console.error(`check-native-module-versions: ${message}`)
  process.exit(1)
}

function loadBundledNativeModules() {
  const require = createRequire(path.join(appDir, "package.json"))
  try {
    return require("expo/bundledNativeModules.json")
  } catch {
    // The subpath may not be exported; read it from the package root instead.
    const expoRoot = path.dirname(require.resolve("expo/package.json"))
    return JSON.parse(
      readFileSync(path.join(expoRoot, "bundledNativeModules.json"), "utf8"),
    )
  }
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

function parseVersion(version) {
  const match = VERSION.exec(version)
  return match ? match.slice(1).map(Number) : null
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

/**
 * Whether `version` satisfies `range`, for the range forms expo uses: exact
 * `x.y.z`, `~x.y.z` and `^x.y.z`. Returns null when either side can't be
 * parsed (including prereleases), which the caller reports as an error.
 */
function satisfies(version, range) {
  const locked = parseVersion(version)
  const operator = range[0] === "~" || range[0] === "^" ? range[0] : ""
  const base = parseVersion(range.slice(operator.length))
  if (!locked || !base) return null
  if (operator === "") return compare(locked, base) === 0
  if (compare(locked, base) < 0) return false
  if (operator === "~") return locked[0] === base[0] && locked[1] === base[1]
  // Caret: same major; same minor when the major is 0; same patch for 0.0.z.
  if (base[0] !== 0) return locked[0] === base[0]
  if (base[1] !== 0) return locked[0] === 0 && locked[1] === base[1]
  return compare(locked, base) === 0
}

/** Guards the range logic itself: a broken `satisfies` would pass everything. */
function selfCheck() {
  const cases = [
    ["15.15.4", "15.15.4", true],
    ["15.15.5", "15.15.4", false],
    ["57.0.30", "~57.0.26", true],
    ["57.0.25", "~57.0.26", false],
    ["57.1.0", "~57.0.26", false],
    ["2.9.0", "^2.2.0", true],
    ["3.0.0", "^2.2.0", false],
    ["0.10.3", "^0.10.1", true],
    ["0.11.0", "^0.10.1", false],
    ["0.0.3", "^0.0.3", true],
    ["0.0.4", "^0.0.3", false],
    ["1.0.0-beta.1", "1.0.0", null],
    ["1.0.0", ">=1.0.0", null],
  ]
  for (const [version, range, want] of cases) {
    const got = satisfies(version, range)
    if (got !== want) {
      fail(
        `self-check: satisfies("${version}", "${range}") is ${got}, expected ${want}`,
      )
    }
  }
}

function main() {
  selfCheck()
  if (!existsSync(lockfilePath)) fail(`lockfile not found at ${lockfilePath}`)
  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"))
  if (!lockfile.packages) fail(`${lockfilePath} has no "packages" map`)

  const expected = loadBundledNativeModules()
  const problems = []
  const usedAllowlist = new Set()
  let checked = 0

  const hoistedCopies = Object.fromEntries(
    Object.keys(MUST_BE_HOISTED).map((name) => [name, []]),
  )

  for (const [key, entry] of Object.entries(lockfile.packages)) {
    const index = key.lastIndexOf("node_modules/")
    if (index === -1 || entry.link || !entry.version) continue
    // An npm alias records the real package name in `name`.
    const name = entry.name ?? key.slice(index + "node_modules/".length)
    hoistedCopies[name]?.push(key)
    const range = expected[name]
    if (range === undefined) continue

    checked++
    const ok = satisfies(entry.version, range)
    if (ok === true) continue
    const allowKey = `${name}@${entry.version}`
    if (ok === false && ALLOWLIST[allowKey]) {
      usedAllowlist.add(allowKey)
      continue
    }
    problems.push(
      ok === null
        ? `${name}@${entry.version} (${key}): can't compare with expected "${range}"`
        : `${name}@${entry.version} (${key}): expected "${range}"`,
    )
  }

  for (const [name, keys] of Object.entries(hoistedCopies)) {
    const rootKey = `node_modules/${name}`
    if (keys.length !== 1 || keys[0] !== rootKey) {
      problems.push(
        `${name} must have exactly one lockfile copy at ${rootKey} (${MUST_BE_HOISTED[name]}); ` +
          `found ${keys.length === 0 ? "none" : keys.join(", ")}. ` +
          "Pin it in the root package.json to the same version as packages/app.",
      )
    }
  }

  for (const allowKey of Object.keys(ALLOWLIST)) {
    if (!usedAllowlist.has(allowKey)) {
      problems.push(
        `${allowKey}: allowlisted but no longer mismatched in the lockfile; remove the entry`,
      )
    }
  }

  if (problems.length > 0) {
    fail(
      `${problems.length} lockfile problem(s):\n` +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\nFor a version that doesn't match the installed Expo SDK, declare the " +
        "package in packages/app at the expected version " +
        "(see expo/bundledNativeModules.json), or allowlist it with a reason.",
    )
  }
  console.log(
    `check-native-module-versions: ${checked} lockfile entries match the installed Expo SDK.`,
  )
}

main()
