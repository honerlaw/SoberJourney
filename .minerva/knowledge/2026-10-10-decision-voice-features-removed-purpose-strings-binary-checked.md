# Voice features removed; purpose strings are removed only on binary evidence

**Date**: 2026-10-10
**Type**: decision
**Theme**: app-infrastructure
**Summary**: Speech packages removed; speech purpose string dropped after an .ipa symbol check; microphone string kept
**Context**: .minerva/work/2026-10-10-remove-voice-features (see git history if the worktree has been cleaned up)

## Context
Three voice pieces were unused:
- `expo-speech-recognition` and its only consumer, the unused `useSpeechToText` hook;
- `expo-speech` (text-to-speech), never imported;
- the iOS purpose strings `NSSpeechRecognitionUsageDescription` and `NSMicrophoneUsageDescription`.

`expo-speech-recognition` 3.0.1 had already broken the SDK 57 iOS build. The user asked to remove "the voice stuff".

The constraint: the `2026-10-06-app-infra-auth-errors` unit removed `NSPhotoLibraryUsageDescription`/`NSCameraUsageDescription` because there was "no image-picker/camera dependency". App Store Connect then rejected 1.2.0 builds 80 and 82 with ITMS-90683, because a bundled SDK still referenced the photo-library API, and PR #52 had to restore the string. Apple checks API references in the binary, not declared dependencies.

## Finding
- Removed: both packages, the hook, and `NSSpeechRecognitionUsageDescription`. A 3/3 approach panel chose this option B over keeping both strings (A) or also removing the microphone string (C).
- **Purpose-string check method.**
  - Build a non-submitting EAS production build (`eas build -p ios --profile production --non-interactive --wait`), then download its `.ipa` from `eas build:view <id> --json` → `artifacts.buildUrl`. Store builds aren't FairPlay-encrypted before Apple processes them.
  - Scan every Mach-O (the main executable plus `Frameworks/*`):
    - `otool -L` and the `otool -l` `LC_LOAD_WEAK_DYLIB` entries for the framework (e.g. `Speech.framework`);
    - `nm -u` for its class prefix (`SFSpeech`);
    - `strings -a` for that prefix, which also catches mangled Swift names such as `So18SFSpeechRecognizerC`.
  - Run the identical scan on a build that still has the API (a positive control), otherwise an empty result proves nothing.
  - Results here:
    - **Control** (`959332ea`, with expo-speech-recognition): main executable `Speech.framework`=1, `nm -u` SFSpeech=2, strings=2.
    - **After removal** (`0e376008`): 0 everywhere.
  - Full output is in the unit's `binary-check-0e376008.txt`.
  - A source grep of `node_modules` is advisory only. The only other "speech" match is React Native's `UIAccessibilitySpeechAttribute*`, which is a UIKit API.
- **`NSMicrophoneUsageDescription` kept.** `react-native-webview` references microphone-capture APIs in source (`react-native-webview/apple`: WKWebView media-capture handling). After the removal, the binary shows no `requestRecordPermission`/`AVAudioApplication`/`recordPermission` strings; the two such hits in the control came from expo-speech-recognition. The string was kept because a dependency- or source-level "nothing uses it" was wrong once, and an unused declared purpose string has no runtime effect.

## Implications
- The binary check is the gate for removing a purpose string; never remove one on a dependency list or source grep alone.
- Even with the check, App Store Connect's ITMS-90683 verdict only arrives after upload, by email or the App Store Connect build state, and EAS can't see it.
- To revisit the microphone string, run the same binary scan for AVFoundation/AVFAudio record-permission and media-capture symbols, then decide with evidence.
- This resolves the "Open product question" in the SDK 57 build entry. The guidance there about hand-bumping `expo-speech-recognition` on SDK upgrades no longer applies.

## Related
- [[2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build]] — resolves its open product question; the module that broke the build is gone
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] — the upgrade context
