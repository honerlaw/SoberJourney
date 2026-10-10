# Proposal: fix-ios-build-react-native-svg

**Date**: 2026-10-10
**Status**: Draft

**Seed:** Fix the iOS EAS build that the Expo SDK 57 upgrade (PR #58) broke, and guard against transitive SDK-managed native modules drifting again. The user wants the PR auto-merged on green CI.

## Goal

Make the iOS EAS builds (development and production) compile again on Expo SDK 57. Declare `react-native-svg` at SDK 57's version in `packages/app`, and add a CI check that fails when any package listed in expo's `bundledNativeModules.json` appears anywhere in the lockfile outside its expected range. That covers root, workspace-local and nested copies, transitive included. The check does not cover native modules that expo doesn't list; that is a stated limit. App-only plus CI; no server or runtime behaviour change.

## Why

- Both the PR #58 dev build (EAS 51c24d0a) and the production build for merge commit b88180d fail in Xcode. `node_modules/react-native-svg/apple/Elements/RNSVGImage.mm:121` and `:128` report "no viable conversion from 'RCTImageResponseObserverProxy' to 'std::shared_ptr<const ImageResponseObserver>'". RN 0.86 changed `ImageResponseObserverCoordinator::add/removeObserver` to take a shared_ptr.
- `react-native-svg` is only transitive: `@tamagui/lucide-icons` and `@tamagui/helpers-icon` declare `>=12`, and `react-native-svg-transformer` declares `>=12.0.0`. Because it isn't declared directly, `npx expo install --fix`/`--check` never aligned it, and the lockfile kept 15.15.1 from the SDK 54 install. SDK 57's `bundledNativeModules.json` expects `15.15.4`. 15.15.4's RNSVGImage.mm guards the call with `#if REACT_NATIVE_MINOR_VERSION > 84` (verified in the 15.15.4 tarball). 15.15.1 has no guard.
- `expo-doctor` and `expo install --check` only validate direct dependencies, so neither caught this. CI's PR job queues the EAS build with `--no-wait`, so the compile failure never surfaced as a red check.
- A lockfile scan against SDK 57's `bundledNativeModules.json` finds exactly two mismatches:
  - `react-native-svg` 15.15.1 vs 15.15.4.
  - `@react-native-async-storage/async-storage` 1.24.0 vs 2.2.0. It is transitive via Clerk → `@solana-mobile/wallet-adapter-mobile`/`wallet-standard-mobile` (`^1.17.7`). It does not appear anywhere in the failed build's 26.5k-line Xcode log, so it is not compiled into the iOS app. It was the same version on SDK 54. The app never imports it.

## Approach

1. **Fix.** Add `"react-native-svg": "15.15.4"` (SDK 57's bundled value, exact) to `packages/app/package.json` dependencies, and update the lockfile with `npm install` so every copy is 15.15.4 (see step 4 for where this runs).
2. **Guard.** Add `packages/app/scripts/check-native-module-versions.mjs`, a dependency-free Node ESM script.
   - **Inputs.** Expo's `bundledNativeModules.json` is resolved from the installed `expo` package root via `createRequire(import.meta.url)`; if the `exports` map blocks the subpath, it falls back to the package root path. The root `package-lock.json` is located relative to the script, not the cwd. Either input missing means exit 1 with a clear message.
   - **Which entries are checked.** Every key of the lockfile's `packages` map whose name is listed in `bundledNativeModules`, matched on the segment after the key's last `node_modules/`. Root, `packages/app/node_modules/…` and nested `…/node_modules/<name>` entries all count. Entries with `link: true` or without a `version` are skipped.
   - **Range semantics.** Only the forms SDK 57 uses: exact (`x.y.z`), `~x.y.z` (≥x.y.z <x.(y+1).0) and `^x.y.z` (≥x.y.z <(x+1).0.0, or <0.(y+1).0 when x=0). Any other range form, and any prerelease or unparseable locked version, is an error, never skipped.
   - **Allowlist.** It is keyed on `name@exactVersion` and applies across all paths, with a comment giving the reason. The single entry is `@react-native-async-storage/async-storage@1.24.0`: transitive via Clerk → `@solana-mobile/*`, not compiled into the iOS build, unused by the app. The comment says to remove the entry once the lockfile reaches 2.x. A different version of an allowlisted package fails.
   - **Output and exposure.** Exit 1 lists each mismatch: name, locked version, expected range and lockfile key. The header states the limits: only packages expo lists are checked, and expo's list includes some JS-only entries that could someday need an allowlist entry. It is exposed as `npm run check:native-modules` in `packages/app`.
3. **CI.** Add a step to `.github/workflows/ci.yml` right after `npm ci`: `npm run check:native-modules --workspace=@onerlaw/soberjourney-app`. A drift then fails the PR check before the build and EAS steps run.
4. **Verify on a clean install.** Fresh clone, then `npm ci`. Then:
   - the check passes;
   - mutations (react-native-svg forced to 15.15.1, allowlist entry removed, allowlisted package at another version) each fail it;
   - `expo config --json`, `npx expo install --check`, root build and test, app lint, knip (add an ignore if it flags `react-native-svg` as unused; the svg transformer and lucide icons need it at runtime), `expo prebuild -p ios --no-install`, and the three production exports all pass.

   The lockfile diff must be limited to the react-native-svg entry and the new direct dependency. The `react-native-svg` spec is written as the bundled value `15.15.4`, by editing package.json plus `npm install` in the fresh clone, not `expo install` against the stale main checkout.
5. **Prove the native compile before the PR.** Run `eas build --platform ios --profile production --non-interactive --wait` from the unit's worktree, without `--auto-submit` and on a clean committed tree. This is the profile the merge fires. The PR is opened only once that build finishes; the `production` profile's `autoIncrement` will bump the remote build number, which is harmless.
   - If the build fails on another native compile error, that is a new divergence: replan, with no PR and no merge.
   - The wait is bounded at 60 minutes. Past that, or on an `eas` error, report to the user rather than shipping.
   - Assumption, stated: a compiling production build implies the PR's development build compiles too. They share the same native sources.
6. **Record.** A new knowledge entry covers the transitive-drift failure, the guard and its limit, and why `react-native-svg` is declared directly. It links to `2026-10-10-reference-expo-sdk-57-upgrade-notes` (add-only).
7. **Ship.** With the compile proven, the PR goes up with auto-merge on green CI, as the user wants.

### Candidate approaches for the guard

- **A (recommended):** the lockfile vs `bundledNativeModules.json` script plus a CI step. It catches transitive and nested drift deterministically and fails fast in CI. Cost: one small script with an allowlist.
- **B:** rely on `expo-doctor` / `expo install --check` in CI. Rejected: both validate direct dependencies only, and neither flagged 15.15.1 (shown during PR #58).
- **C:** declare every SDK-managed native module that the app uses transitively, with no check. It fixes today's cases but gives no protection against the next transitive drift. Dominated by A, which also covers this.
- **D:** make every PR's CI wait for the EAS build (drop `--no-wait`) so compile errors turn the PR red. Rejected as the guard: it adds about 20+ minutes and EAS build minutes to every PR, and it changes the CI/billing contract. It may be worth doing separately; out of scope.

## Success criteria

1. `packages/app/package.json` declares `"react-native-svg": "15.15.4"`, SDK 57's bundled value. On a clean `npm ci`, every lockfile copy is 15.15.4 (`npm ls react-native-svg`). The lockfile diff is limited to that change.
2. `npm run check:native-modules` (packages/app) exits 0 on the fixed lockfile and scans every lockfile key, including `packages/app/node_modules/*` and nested entries. In scratch copies it exits 1, naming package, version, range and key, for each of these:
   - (a) react-native-svg at 15.15.1;
   - (b) the async-storage allowlist entry removed;
   - (c) the allowlisted package at a different version.
3. `.github/workflows/ci.yml` runs the check right after `npm ci`, and the PR's CI check is green.
4. On a fresh clone with `npm ci`, all of these succeed: `expo config --json`, `npx expo install --check`, root `npm run build` and `npm run test`, app lint with 0 errors, knip with no new findings, `NODE_ENV=production expo export -p ios|android|web`, and `expo prebuild -p ios --no-install`. No untracked file (e.g. the main checkout's `app.json`) enters the PR.
5. A non-submitting EAS iOS **production** build finishes successfully before the PR is opened, covering the final native-affecting state. If `packages/app/package.json`, `package-lock.json` or `packages/app/app.json` change after that build, it is re-run. Its build ID and status are recorded in the scratchpad and the PR body.
6. A new knowledge entry records the failure, the guard and its limit, linking `2026-10-10-reference-expo-sdk-57-upgrade-notes`.

## Open Questions

- None blocking. Whether to make CI wait on EAS builds (D) is noted as a follow-up idea, not this unit.
