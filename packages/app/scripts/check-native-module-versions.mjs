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
 * (some of which are JS-only); other transitive native modules are not.
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
 * different version of a listed package still fails, so a change forces a
 * fresh look.
 */
const ALLOWLIST = {
  // Transitive via @clerk/clerk-expo → @solana-mobile/wallet-*-mobile (^1.17.7).
  // Not imported by the app and not compiled into the iOS build. Remove once
  // the lockfile reaches the 2.x expo expects.
  "@react-native-async-storage/async-storage@1.24.0":
    "unused transitive dependency of Clerk's Solana wallet adapters",
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
export function satisfies(version, range) {
  const locked = parseVersion(version)
  const operator = range[0] === "~" || range[0] === "^" ? range[0] : ""
  const base = parseVersion(range.slice(operator.length))
  if (!locked || !base) return null
  if (operator === "") return compare(locked, base) === 0
  if (compare(locked, base) < 0) return false
  if (operator === "~") return locked[0] === base[0] && locked[1] === base[1]
  // Caret: same major, or same minor when the major is 0.
  if (base[0] !== 0) return locked[0] === base[0]
  return locked[0] === 0 && locked[1] === base[1]
}

function main() {
  if (!existsSync(lockfilePath)) fail(`lockfile not found at ${lockfilePath}`)
  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"))
  if (!lockfile.packages) fail(`${lockfilePath} has no "packages" map`)

  const expected = loadBundledNativeModules()
  const problems = []
  let checked = 0

  for (const [key, entry] of Object.entries(lockfile.packages)) {
    const index = key.lastIndexOf("node_modules/")
    if (index === -1 || entry.link || !entry.version) continue
    const name = key.slice(index + "node_modules/".length)
    const range = expected[name]
    if (range === undefined) continue

    checked++
    const ok = satisfies(entry.version, range)
    if (ok === true) continue
    if (ok === false && ALLOWLIST[`${name}@${entry.version}`]) continue
    problems.push(
      ok === null
        ? `${name}@${entry.version} (${key}): can't compare with expected "${range}"`
        : `${name}@${entry.version} (${key}): expected "${range}"`,
    )
  }

  if (problems.length > 0) {
    fail(
      `${problems.length} package(s) don't match the installed Expo SDK:\n` +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\nDeclare the package in packages/app at the expected version " +
        "(see expo/bundledNativeModules.json), or allowlist it with a reason.",
    )
  }
  console.log(
    `check-native-module-versions: ${checked} lockfile entries match the installed Expo SDK.`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
