# The SDK 57 lockfile left expo-router where `@expo/cli` could not find it, so every production web export failed

**Date**: 2026-10-10
**Type**: bug
**Theme**: app-infrastructure
**Summary**: npm nested expo-router under packages/app, so the production web export failed; a root pin hoists it and CI exports the web bundle
**Context**: .minerva/work/2026-10-10-fix-web-export-expo-router-hoisting (see git history if the worktree has been cleaned up)

## Context
DigitalOcean App Platform builds `sober-journey-prod` with the Node buildpack:
- it runs `npm ci` at the repo root, then `npm run build:prod`;
- `build:prod` first runs the server's `build:web`, which runs `expo export -p web` in packages/app and moves `dist` into `packages/server/static`.

Every deploy after the Expo SDK 57 upgrade (PR #58, b88180d), up to 17808ee, failed in that step with:

> Error: Cannot find module 'expo-router/build/utils/url'

The error was thrown from `node_modules/expo/node_modules/@expo/cli/build/src/export/exportStaticAsync.js`. Prod kept serving the last SDK 54 deployment.

## Finding
- **Placement.** From b88180d on, the lockfile puts `@expo/cli` at `node_modules/expo/node_modules/@expo/cli` and `expo-router` at `packages/app/node_modules/expo-router`.
  - Node resolves a module by walking up from the requiring file, so from `@expo/cli` it reaches only the root `node_modules` and never `packages/app/node_modules`.
  - Root `node_modules/expo-router` was empty. `npm dedupe` would not hoist the package. `NODE_PATH` did not help `expo export` either.
- **Why it went unseen:**
  - CI ran only `npm run build`, which is server tsc plus app `tsc --noEmit`, so it never exported the web bundle.
  - The main checkout's `node_modules` was still the SDK 54 install, with everything hoisted, so local builds passed.
  - Only a fresh `npm ci` reproduced the failure.
- **Fix:** declare `"expo-router": "57.0.25"` in the **root** `package.json` `dependencies`, the same pin as packages/app, and regenerate the lockfile with `npm install --package-lock-only` (npm 11).
  - expo-router now installs at root, where `@expo/cli` and `@expo/router-server` resolve it.
  - No name@version was added or removed.
  - npm re-deduped and re-nested a few copies: −2 `@expo/schema-utils`, −1 `expo-server`, and +11 copies of web-only `@radix-ui` packages that expo-router depends on.
  - The only resolution changes are expo-router itself and the optional, type-only `@types/react` peer of those radix packages.
  - Autolinking module sets are unchanged.
  - The work unit's `resolution_map.py` performs these checks.
- **Guard:** CI runs `npm run build:web --workspace=@onerlaw/soberjourney-server` after the tests and before the EAS step. That is the first half of DigitalOcean's `build:prod`, so a broken production web export now fails the PR.

## Implications
- **Pin coupling.** The root and packages/app `expo-router` pins must move together on every SDK bump. If they diverge, npm nests a copy under packages/app again and the export breaks. The CI step catches this before merge, but bump both pins in the same change.
- **`@types/react` split.** Two copies are in the tree: root 19.3.0 and packages/app 19.2.18. The moved radix packages now see the root copy. Nothing ships from `@types`, but this is a likely source of JSX/`ReactNode` type mismatches on a future React or types upgrade.
- **Verify on a fresh install.** For any dependency or SDK change, run `npm ci` in a clean worktree, then `npm run build:prod` with a mock `packages/server/.env`. A stale `node_modules` hides placement bugs, and the SDK 57 notes' advice to run `expo export -p web` is not enough on a warm install.
- **Cron job.** DigitalOcean's `soberjourney-cron` job also runs `build:prod`, so it builds a web bundle it never serves. Its build command lives in the DO app spec, outside the repo.

## Related
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] — the same un-hoisting, fixed then for `@expo/metro-runtime` and `@expo/config-plugins` by declaring them directly
- [[2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build]] — the other SDK 57 lockfile-placement failure that JS-only checks missed
- [[2026-10-10-decision-liquid-glass-navigation-native-tabs]] — the upgrade PR whose deploys failed
