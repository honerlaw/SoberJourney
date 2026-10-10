# Replans: fix-ios-build-react-native-svg

## 2026-10-10 — The pre-PR EAS build surfaced a second native break: expo-speech-recognition

### Original plan
- Fix the iOS build by declaring `react-native-svg` 15.15.4, the version SDK 57 bundles.
- Add a lockfile-vs-`bundledNativeModules` drift check in CI.
- Prove the native compile with a non-submitting EAS **production** build before opening the PR (Approach step 5; criterion 5).
- The proposal's own rule: "If the build fails on another native compile error, that is a new divergence: replan, with no PR and no merge."

### What changed
- EAS production build `9187da96` (commit 2e99ffd) **compiled past `RNSVGImage.mm`**: 247 RNSVG compile lines and no svg error, so the svg fix works.
- That build then failed on a different module: `node_modules/expo-speech-recognition/ios/ExpoSpeechRecognitionModule.swift:118:26: error: cannot convert value of type 'Promise.ResolveClosure' … to expected argument type 'EXPromiseResolveBlock'`. That was the only error in the log.
- Cause: the app declares `expo-speech-recognition` `^3.0.1`, and the lockfile has 3.0.1. Version 3.0.1 passes `promise.resolver` to the legacy `askForPermission(usingRequesterClass:resolve:reject:)` API. The `Promise` type in expo-modules-core 57 no longer converts there.
- The package now versions with the Expo SDK, with releases 56.x and 57.0.0–57.1.1. In 57.1.1 the same call reads `resolve: legacyResolveBlock(for: promise)` (verified in the tarball), and its JS exports are unchanged.
- The package is third-party and not in `bundledNativeModules.json`. Neither `expo install --check` nor the new drift check can see it, so this is a known limit of the guard, not a defect in it.
- **Scan.** I ran `grep -rlE "promise\.resolver|legacyRejecter|EXPromiseResolveBlock" node_modules --include='*.swift' --include='*.m' --include='*.mm'`, excluding `expo-modules-core`. It finds only `expo-speech-recognition` among third-party packages. The other hits, `expo-file-system` and `expo-notifications`, are first-party SDK 57 packages already aligned to that core.
- **The scan is heuristic.** It covers only those three patterns and only reduces risk. It cannot rule out other kinds of breakage, such as C++ API changes like the svg one or Swift API removals. Xcode stops at the first failing target, so **the EAS re-run is the only proof**.

### New plan
1. Upgrade `expo-speech-recognition` to `~57.1.1` in `packages/app`, the SDK-versioned line for SDK 57, and update the lockfile.
   - Its only consumer is `src/hooks/useSpeechToText`. `grep -rn useSpeechToText packages/app/src` finds only the hook's own definition and its `index.ts` re-export, and knip's existing "unused files" finding lists both. Voice input is therefore not live, the major-version jump has no runtime consumer, and type-check is the needed verification (done: tsc passes).
   - `app.json` has no `expo-speech-recognition` config plugin. Only `NSSpeechRecognitionUsageDescription` and `NSMicrophoneUsageDescription` infoPlist strings exist, and they are unaffected.
   - With the bump applied: `expo prebuild -p ios --no-install` and `NODE_ENV=production expo export -p ios|android|web` pass, and lint has 0 errors.
   - **Alternative considered and rejected:** removing the package and the unused hook. That removes dead native surface, including the mic and speech-recognition permission strings that App Store review treats as privacy-relevant. But whether voice input stays in the product is the user's call, not a build fix's, so the minimal fix is the upgrade. It is recorded as an Open Question and raised in the PR.
   - **Also considered and left out:** extending the guard to SDK-versioned third-party modules, for example by checking `expo-*` packages against `expo.sdkVersion`.
2. Re-run the fresh-install gate (criterion 4) on the new lockfile.
3. **Re-run the pre-PR EAS production build (criterion 5).** The proposal's existing rule requires it when `package.json`, the lockfile or `app.json` change. The original 60-minute wait bound and the report-to-user-on-`eas`-error rule still apply. Its result decides the next step:
   - It succeeds → continue to completion verification and ship.
   - It fails on yet another native error → this replan protocol runs again, with no PR and no merge.
4. Amend the success criteria:
   - Criterion 1's lockfile-diff limit covers both package changes, `react-native-svg` and `expo-speech-recognition`.
   - Add criterion 7: `packages/app/package.json` declares `expo-speech-recognition` `~57.1.1`, and the lockfile resolves it to at least 57.1.1 and below 57.2.0.
   - Criterion 5 refers to the final build, not `9187da96`.
   - Criterion 6's knowledge entry also records that SDK-versioned third-party native modules (like `expo-speech-recognition`, whose peer dependencies are `*`) sit outside the guard and must be bumped by hand on each SDK upgrade.
5. Add an Open Question: should voice input stay? If not, remove `expo-speech-recognition`, the unused hook and the permission strings, as a follow-up the user decides on.
