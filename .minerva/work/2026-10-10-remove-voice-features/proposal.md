# Proposal: remove-voice-features

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)

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

What shipped (approach B; full record in scratchpad and `binary-check-0e376008.txt`):

1. **Removed** `expo-speech-recognition` and `expo-speech` from `packages/app`. The lockfile lost exactly those two entries, and `npm ls` before and after differs by those two only. `src/hooks/useSpeechToText/` was deleted. Neither package had an `app.json` plugin or an Android permission.
2. **Removed `NSSpeechRecognitionUsageDescription`**, gated on a binary check.
   - The non-submitting EAS iOS production build `0e376008` (f210001, build 102, `.ipa` sha256 `015e9f78…b6f3e3`) shows no `Speech.framework` link (strong or weak), no `nm -u` `SFSpeech` and no `strings` `SFSpeech` in any Mach-O, main executable and all frameworks.
   - The positive control `959332ea`, still containing expo-speech-recognition, shows hits with the identical scan.
   - The source grep, advisory only, found nothing beyond React Native's UIKit `UIAccessibilitySpeechAttribute*`.
3. **Kept `NSMicrophoneUsageDescription`.** `react-native-webview` references WKWebView media-capture APIs in source. After the removal, the binary shows no record-permission strings: the control's two hits came from expo-speech-recognition. The string stays on the PR #52 precedent, because an unused declared purpose string has no runtime effect. The PR flags it for the user to veto.
4. **Gate** on a clean `npm ci`, all passing:
   - root build, and tests 262/262;
   - lint with 0 errors, tsc;
   - `check:native-modules` (49 entries) and `expo install --check`;
   - the three production exports;
   - prebuild for iOS (Info.plist keeps only the microphone key) and Android (no `RECORD_AUDIO`/`RecognitionService`);
   - knip, which lost exactly the two hook files.
5. **Knowledge:** `.minerva/knowledge/2026-10-10-decision-voice-features-removed-purpose-strings-binary-checked.md`, which records the binary-check method and resolves the SDK 57 bug entry's open question.

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
   - `NSMicrophoneUsageDescription` is present. Its reason is `react-native-webview`'s media-capture source references plus the PR #52 precedent. The post-removal binary shows no record-permission strings, and that is recorded honestly. The reason appears in the proposal, the PR and the knowledge entry.
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
