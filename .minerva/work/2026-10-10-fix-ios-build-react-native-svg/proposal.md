# Proposal: fix-ios-build-react-native-svg

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)

**Seed:** Fix the iOS EAS build that the Expo SDK 57 upgrade (PR #58) broke, and guard against transitive SDK-managed native modules drifting again. The user wants the PR auto-merged on green CI.

## Goal

Make the iOS EAS builds (development and production) compile again on Expo SDK 57, and fail CI when a package expo pins for the installed SDK drifts anywhere in the lockfile (transitive included). App-only plus CI; no server or runtime behaviour change. The work turned up a second broken native module mid-run, `expo-speech-recognition`; see replan.md.

## Why

- Both the PR #58 dev build (EAS 51c24d0a) and the production build for merge commit b88180d fail in Xcode. `node_modules/react-native-svg/apple/Elements/RNSVGImage.mm:121` and `:128` report "no viable conversion from 'RCTImageResponseObserverProxy' to 'std::shared_ptr<const ImageResponseObserver>'". RN 0.86 changed `ImageResponseObserverCoordinator::add/removeObserver` to take a shared_ptr.
- `react-native-svg` is only transitive: `@tamagui/lucide-icons` and `@tamagui/helpers-icon` declare `>=12`, and `react-native-svg-transformer` declares `>=12.0.0`. Because it isn't declared directly, `npx expo install --fix`/`--check` never aligned it, and the lockfile kept 15.15.1 from the SDK 54 install. SDK 57's `bundledNativeModules.json` expects `15.15.4`. 15.15.4's RNSVGImage.mm guards the call with `#if REACT_NATIVE_MINOR_VERSION > 84` (verified in the 15.15.4 tarball). 15.15.1 has no guard.
- `expo-doctor` and `expo install --check` only validate direct dependencies, so neither caught this. CI's PR job queues the EAS build with `--no-wait`, so the compile failure never surfaced as a red check.
- A lockfile scan against SDK 57's `bundledNativeModules.json` finds exactly two mismatches:
  - `react-native-svg` 15.15.1 vs 15.15.4.
  - `@react-native-async-storage/async-storage` 1.24.0 vs 2.2.0. It is transitive via Clerk → `@solana-mobile/wallet-adapter-mobile`/`wallet-standard-mobile` (`^1.17.7`). It does not appear anywhere in the failed build's 26.5k-line Xcode log, so it is not compiled into the iOS app. It was the same version on SDK 54. The app never imports it.

## Approach

What shipped:

1. **`react-native-svg` declared at `15.15.4`**, SDK 57's bundled version, in `packages/app`.
   - It had been transitive-only: `@tamagui/lucide-icons`, `@tamagui/helpers-icon` and `react-native-svg-transformer` all accept `>=12`. So `expo install --fix` never moved it off 15.15.1, which doesn't compile against RN 0.86 (`RNSVGImage.mm` and the `ImageResponseObserver` `shared_ptr`).
   - The lockfile diff is the svg entry plus `peer` flags dropped on its own dependencies.
2. **`expo-speech-recognition` bumped from `^3.0.1` to `~57.1.1`** (replan 2026-10-10).
   - 3.0.1 used the legacy permissions API, which no longer compiles against expo-modules-core 57. The pre-PR EAS build found this once svg compiled.
   - Its only consumer, `useSpeechToText`, is unused, and its JS API is unchanged.
3. **`packages/app/scripts/check-native-module-versions.mjs`**, a dependency-free Node ESM script exposed as `npm run check:native-modules`.
   - **What it checks:** every key of the lockfile's `packages` map, matched by the name after the key's last `node_modules/` (or `entry.name` for npm aliases), against the installed expo's `bundledNativeModules.json`. Range forms are exact, `~` and `^`, including the `^0.y`/`^0.0.z` rules. Unparseable or prerelease versions fail.
   - **Allowlist:** keyed on `name@version` across all paths. A stale entry fails. The single entry is `@react-native-async-storage/async-storage@1.24.0`, transitive via Clerk's Solana adapters and not autolinked on iOS.
   - **Self-check:** the range logic runs a self-check on every invocation.
   - **Known limit:** only packages expo lists are checked; SDK-versioned third-party native modules are not.
4. **CI.** `.github/workflows/ci.yml` runs the check right after `npm ci`. `knip.json` lists `scripts/*.mjs` as entries.
5. **Native compile proven before the PR** by non-submitting EAS iOS production builds:
   - `9187da96` errored on expo-speech-recognition, which led to the replan;
   - `959332ea` on 0f3fad0 finished.

   No `package.json`, lockfile or `app.json` change came after it.
6. **Knowledge.** `.minerva/knowledge/2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build.md`.

Not done, and deliberately out of scope:
- making every PR's CI wait on its EAS build (option D);
- extending the guard to SDK-versioned third-party modules;
- removing the unused voice-input package (Open Question).

## Success criteria

1. `packages/app/package.json` declares `"react-native-svg": "15.15.4"`, SDK 57's bundled value. On a clean `npm ci`, every lockfile copy is 15.15.4 (`npm ls react-native-svg`). The lockfile diff is limited to that change and the `expo-speech-recognition` bump (criterion 7; replan.md 2026-10-10).
2. `npm run check:native-modules` (packages/app) exits 0 on the fixed lockfile and scans every lockfile key, including `packages/app/node_modules/*` and nested entries. In scratch copies it exits 1, naming package, version, range and key, for each of these:
   - (a) react-native-svg at 15.15.1;
   - (b) the async-storage allowlist entry removed;
   - (c) the allowlisted package at a different version.
3. `.github/workflows/ci.yml` runs the check right after `npm ci`, and the PR's CI check is green.
4. On a fresh clone with `npm ci`, all of these succeed: `expo config --json`, `npx expo install --check`, root `npm run build` and `npm run test`, app lint with 0 errors, knip with no new findings, `NODE_ENV=production expo export -p ios|android|web`, and `expo prebuild -p ios --no-install`. No untracked file (e.g. the main checkout's `app.json`) enters the PR.
5. A non-submitting EAS iOS **production** build finishes successfully before the PR is opened, covering the final native-affecting state. If `packages/app/package.json`, `package-lock.json` or `packages/app/app.json` change after that build, it is re-run. Its build ID and status are recorded in the scratchpad and the PR body.
6. A new knowledge entry records the failure, the guard and its limit (including that SDK-versioned third-party native modules sit outside it), linking `2026-10-10-reference-expo-sdk-57-upgrade-notes`.
7. `packages/app/package.json` declares `expo-speech-recognition` `~57.1.1`, and the lockfile resolves it to at least 57.1.1 and below 57.2.0 (replan.md 2026-10-10).

## Open Questions

- Voice input: `expo-speech-recognition` and `useSpeechToText` are unused. Should they and the speech and microphone permission strings be removed? That is the user's call and a follow-up (replan.md 2026-10-10).

- None blocking. Whether to make CI wait on EAS builds (D) is noted as a follow-up idea, not this unit.
