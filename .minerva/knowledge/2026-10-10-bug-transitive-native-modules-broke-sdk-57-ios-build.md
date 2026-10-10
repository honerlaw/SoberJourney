# The Expo SDK 57 iOS build broke on native modules that `expo install --fix` never aligned

**Date**: 2026-10-10
**Type**: bug
**Theme**: app-infrastructure
**Summary**: SDK 57 iOS builds failed on unaligned react-native-svg and expo-speech-recognition; CI lockfile guard added
**Context**: .minerva/work/2026-10-10-fix-ios-build-react-native-svg (see git history if the worktree has been cleaned up)

## Context
PR #58 upgraded the app to Expo SDK 57 (RN 0.86). Every JS-side check passed: tsc, lint, expo-doctor, `expo install --check`, the three exports and `expo prebuild`. But both the PR's EAS dev build and the merge's production build failed in Xcode. CI only queues the EAS build with `--no-wait`, so the failure never turned a GitHub check red.

## Finding
Two native modules were still on SDK 54-era versions, and neither of Expo's tools looked at them.
1. **`react-native-svg` 15.15.1.**
   - It was a transitive-only dependency, via `@tamagui/lucide-icons`/`helpers-icon` and `react-native-svg-transformer`, all `>=12`.
   - `RNSVGImage.mm:121/128` passed the observer proxy by value, and RN 0.86's `ImageResponseObserverCoordinator` takes a `shared_ptr` ("no viable conversion from 'RCTImageResponseObserverProxy' to 'std::shared_ptr<const ImageResponseObserver>'").
   - SDK 57's `bundledNativeModules.json` pins `15.15.4`, which guards the call with `#if REACT_NATIVE_MINOR_VERSION > 84`.
   - Fixed by declaring `"react-native-svg": "15.15.4"` in `packages/app`.
2. **`expo-speech-recognition` 3.0.1.**
   - It is a third-party module that versions alongside the Expo SDK, and it is not in `bundledNativeModules.json`.
   - It passed `promise.resolver` to the legacy permissions API (`ExpoSpeechRecognitionModule.swift:118`), which no longer converts with expo-modules-core 57.
   - Fixed by moving to `~57.1.1`, which uses `legacyResolveBlock(for:)`.
   - Its only consumer, `useSpeechToText`, is unused.

`expo install --check` and expo-doctor validate **direct** dependencies against the SDK only. Xcode stops at the first failing target, so each fix exposed the next break. Only a full EAS build proved the native compile: build `959332ea` finished on the final commit.

**Guard.** `packages/app/scripts/check-native-module-versions.mjs` runs in CI right after `npm ci` (`npm run check:native-modules`).
- **What it checks:** every lockfile copy (root, workspace-local, nested, and aliased via `entry.name`) of a package listed in the installed expo's `bundledNativeModules.json`, against its exact/`~`/`^` range.
- **Allowlist:** keyed on `name@version`. A different version fails, and so does an allowlist entry that no longer matches anything. The single entry is `@react-native-async-storage/async-storage@1.24.0`, which comes transitively via Clerk's Solana adapters and is not autolinked on iOS.
- **Self-check:** the range logic tests itself on every run.

## Implications
- **What the guard can't see:** native modules expo doesn't list. In particular, SDK-versioned third-party modules like `expo-speech-recognition` (peer dependencies `*`) must be bumped by hand on every SDK upgrade. Check each third-party native dependency's release line when changing SDKs.
- **What it costs:** one EAS build. A JS-only verification pass does not prove an SDK upgrade. Before merging an upgrade, run a non-submitting EAS production build (`eas build -p ios --profile production --non-interactive --wait`). CI's `--no-wait` dev build only queues one.
- **Open product question:** `expo-speech-recognition`, `useSpeechToText` and the speech/microphone permission strings are unused. Removing them would shrink the native surface. Whether voice input stays is the user's call.

## Related
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] — the upgrade whose build this fixed; its "verify on a fresh npm ci" note was not sufficient on its own
- [[2026-10-10-decision-liquid-glass-navigation-native-tabs]] — the PR whose builds failed
