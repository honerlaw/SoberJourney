# Proposal: remove-voice-features

**Date**: 2026-10-10
**Status**: Draft

**Seed (user):** "the removal of the voice stuff". This is a follow-up to the open question in PR #59: `expo-speech-recognition`, `useSpeechToText` and the speech/microphone permission strings are unused.

## Goal

Remove the app's unused voice features:
- the `expo-speech-recognition` dependency and the `src/hooks/useSpeechToText` hook;
- the `expo-speech` (text-to-speech) dependency, which is also declared but imported nowhere;
- the iOS speech-recognition purpose string.

The change shrinks the native surface. It aims to avoid an App Store ITMS-90683 rejection: it is binary-checked before merge, and App Store Connect's verdict is observed after, and it changes no runtime behaviour, since nothing uses these. App-only; no server change.

## Why

- `useSpeechToText` is referenced only by its own `index.ts`. Knip reports both files as unused. `expo-speech` has no import anywhere in `packages/app/src`.
- Each unused native module is native code that has to compile on every SDK upgrade. `expo-speech-recognition` 3.0.1 broke the SDK 57 iOS build (knowledge `2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build`), and it sits outside the native-module drift guard.
- The purpose strings appear in the app's privacy surface (App Store privacy / Info.plist) for features that don't exist.

**Constraint from history.** The `2026-10-06-app-infra-auth-errors` unit removed `NSPhotoLibraryUsageDescription`/`NSCameraUsageDescription` because there was "no image-picker/camera dependency". App Store Connect then rejected 1.2.0 builds 80 and 82 with ITMS-90683, because a bundled SDK still referenced the photo-library API. PR #52 had to restore the string. Apple's check is on API references in the binary, not on declared dependencies. So a purpose string may only be removed when no remaining native code references the corresponding API, not merely when the obvious package is gone.

## Approach

All work happens in the unit's worktree, on a clean `npm ci` of origin/main (9e5cd06, which already contains the SDK 57 build fix #59). The stale main checkout is never used.

1. **Remove.**
   - Run `npm uninstall -w packages/app expo-speech-recognition expo-speech`, update the lockfile, and delete `src/hooks/useSpeechToText/`.
   - Neither package has a config-plugin entry in `app.json`, `app.config.ts` or `eas.json`, and there is no Android permission entry (verified on origin/main). Both purpose strings are plain `ios.infoPlist` entries.
   - Record `npm ls --all --parseable` before and after, so the lockfile criterion can be checked mechanically.
2. **Source scan: advisory, a first filter only. Correctness rests on step 5.** Run `rg -l` over `node_modules` restricted to `*.swift`, `*.m`, `*.mm` and `*.h` in `ios/` and `apple/` directories, plus `node_modules/react-native/**`, after the removal.
   - **Speech** patterns: `SFSpeechRecognizer|SFSpeechAudioBufferRecognitionRequest|<Speech/|import Speech`.
   - **Microphone** patterns, informational only: `requestRecordPermission|AVAudioSessionRecordPermission|AVAudioApplication|AVMediaTypeAudio|WKMediaCaptureType`.
   - The exact commands and output go in the scratchpad.
3. **Remove `NSSpeechRecognitionUsageDescription` in the same commit**, provided the source scan is empty. Whether the removal stands depends on step 5's binary check, not on this scan.
4. **Keep `NSMicrophoneUsageDescription`.**
   - ITMS-90683 is triggered by API references in the binary, whether or not the string is ever shown. A declared but unused purpose string has no runtime effect. Removing a needed one cost two rejected builds (PR #52).
   - `react-native-webview` 13.16.1 references microphone-capture APIs in its iOS **source**. This is established by the source scan run during propose: `react-native-webview/apple` matched. Whether those references survive into the **binary** is recorded by step 5's informational microphone-symbol check.
   - The string stays whatever the scans show. Keeping these strings to the stricter standard is deliberate risk tiering: the speech string is removed only on binary proof; the microphone string is never removed on inference.
   - The PR states this explicitly, so the user can veto it.
5. **Prove the native build and check the binary before the PR.**
   - Run a non-submitting EAS iOS production build (`--wait`, 60-minute bound) of the final native state, and record its build ID.
   - Download its `.ipa` (`eas build:view <id> --json` → `artifacts.buildUrl`) and record the `.ipa` sha256. Store builds are not FairPlay-encrypted before Apple processes them.
   - Scan every Mach-O: the main executable plus `Frameworks/*/<binary>`.
     - `otool -L` for `Speech.framework`, and `otool -l` for `LC_LOAD_WEAK_DYLIB` on it.
     - `nm -u` piped through grep for `SFSpeech`.
     - `strings -a` piped through grep for `SFSpeech`. This also matches mangled Swift names, e.g. `So18SFSpeechRecognizerC`.
   - Save the full outputs to the scratchpad.
   - **Positive control (required).** The identical scan on the pre-removal build `959332ea` (0f3fad0, still containing `expo-speech-recognition`) must show hits, otherwise an empty result proves nothing. It was run during propose: main executable `Speech.framework`=1, `SFSpeech` undefined symbols=2, `SFSpeechRecognizer` strings=2.
   - **No Speech reference:** the removal stands.
     - **Speech reference found:** restore `NSSpeechRecognitionUsageDescription`. Restoring a plist key does not change the binary's symbols, so a restore needs an `expo prebuild` Info.plist check, not a rebuild. This is a recorded exception to criterion 5's re-run rule for this one key.
   - Also record the microphone symbols (`AVAudioSession`/`AVAudioApplication` record permission), for information. They go into the knowledge entry so a later decision about the microphone string has evidence.
   - **Residual risk, stated:**
     - This is a proxy for Apple's check: it proves compilation and the absence of Speech symbols.
     - App Store Connect's ITMS-90683 verdict comes only from Apple's post-upload processing (App Store Connect build state or Apple's email), minutes to hours after upload. EAS cannot observe it.
     - The PR's CI dev build also uploads to TestFlight, but auto-merge on unprotected `main` merges at the same time, so it gives no lead and is not evidence for the production binary.
     - **Owner:** the user confirms the App Store Connect processing state (or watches for Apple's email). The report hands this over explicitly.
     - A rejection costs one build number plus a one-line restore follow-up.
6. **Gate.**
   - On a clean `npm ci`: tsc, lint, knip, `check:native-modules`, `expo install --check`, the root build and tests, the three production exports, and `expo prebuild -p ios` and `-p android`.
   - The generated Android manifest has no `RECORD_AUDIO` and no `RecognitionService`.
   - Knip loses the two `useSpeechToText` files and gains nothing.
7. **Knowledge.** Add a new entry recording that the voice features were removed, which strings were kept and why, and the binary-check method for purpose strings. It links to and resolves the "Open product question" in `2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build` (add-only).
8. **Ship.** Open the PR with auto-merge. `main` is unprotected, so it merges immediately.
   - Before reporting, confirm `git diff <verified-commit> <merge-commit> -- package-lock.json packages/app/package.json packages/app/app.json` is empty, so the merged native inputs equal the verified ones.
   - Then poll `eas build:list` for the merge commit's production build and its submission (criterion 6).

### Candidate approaches
- **A:** remove the packages and hook, but keep both permission strings. Zero rejection risk, but it leaves a speech-recognition purpose string for a feature that no longer exists, and it ignores part of the request.
- **B (recommended):** remove the packages and hook; remove the speech string only if the scan proves no Speech-framework reference remains; keep the microphone string. This removes the feature and its unique purpose string, and keeps the one whose API is plausibly still referenced.
- **C:** remove everything, including the microphone string, after a scan. This most fully matches "remove the voice stuff", but it repeats the exact reasoning that caused the PR #52 rejection, and the webview media-capture code makes a microphone reference likely.

## Success criteria

1. `packages/app/package.json` no longer lists `expo-speech-recognition` or `expo-speech`, and the lockfile has no entry for either. The before/after `npm ls --all --parseable` difference lists only those two packages and packages nothing else depends on.
2. `src/hooks/useSpeechToText/` is deleted. `grep -rn "expo-speech\|useSpeechToText\|SpeechRecognition"` over `packages/app` (excluding `node_modules`), `.github`, the root config files, `knip.json`, `scripts/check-native-module-versions.mjs` and the README finds nothing outside `.minerva` records. In `app.json`, only the speech key is gone.
3. The source scan, the binary-check outputs and the `.ipa` sha256 are saved in the scratchpad.
   - The positive control on `959332ea` shows Speech hits. The pre-PR build's scan is empty for `Speech.framework` (strong and weak links), `nm -u` `SFSpeech` and `strings` `SFSpeech`.
   - On that basis `NSSpeechRecognitionUsageDescription` is absent from `app.json`. If any hit is found, it is present.
   - `NSMicrophoneUsageDescription` is present, with its reason (now backed by `react-native-webview`'s media-capture source references, plus the recorded binary microphone symbols) in the proposal, the PR and the knowledge entry.
4. On a clean `npm ci`, all of these pass:
   - tsc;
   - lint with 0 errors;
   - `npm run check:native-modules`;
   - `npx expo install --check`;
   - root build and tests;
   - `NODE_ENV=production expo export -p ios|android|web`;
   - `expo prebuild -p ios` and `-p android --no-install`, with no `RECORD_AUDIO` or `RecognitionService` in the generated Android manifest;
   - knip loses only the two `useSpeechToText` files.
5. A non-submitting EAS iOS production build of the final native state finishes before the PR, its build ID is recorded, and it is the build the binary check ran on.
   - It is re-run if `package.json`, the lockfile or `app.json` change after it. The one exception: restoring `NSSpeechRecognitionUsageDescription` per step 5.
   - The merged commit's native inputs equal the verified commit's (diff empty).
6. After merge, the run reports, with IDs:
   - (a) the merge commit's production EAS build reached **FINISHED**;
   - (b) its submission reached **FINISHED**, meaning uploaded to App Store Connect.

   EAS cannot observe App Store Connect's processing verdict (ITMS-90683), so the report states it as **pending**, and hands it to the user to confirm in App Store Connect or Apple's email. Neither the report nor the record claims it as passed.
   - (a) or (b) failing fails this criterion.
   - A later ITMS-90683 triggers the one-line restore follow-up.
7. A new knowledge entry exists, linked to the SDK 57 bug entry, recording the removal, the kept microphone string and why, and the binary-check method.

## Open Questions
- None blocking.
