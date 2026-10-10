# Scratchpad: remove-voice-features

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [reviewed — clean] scope check: one unit, one unphased PR removing expo-speech-recognition + expo-speech + useSpeechToText + (binary-gated) speech purpose string; expo-speech kept in scope (unused voice surface, no permission string) (tier: reviewer — removal is not additive, denies solo; no panel clause; parallel wave). Noted: binary-level check suggested — folded via whole-proposal.
- [panel — 3/3 accept, 3 with fixes] approach: B — remove packages + hook; remove NSSpeechRecognitionUsageDescription only on proof; keep NSMicrophoneUsageDescription; rejected A (leaves a dead speech string, ignores part of the request) and C (removing the mic string repeats the PR #52 ITMS-90683 reasoning) (tier: panel — genuine ambiguity A/B/C + documented constraint: the 2026-10-06-app-infra-auth-errors purpose-string removal that caused ITMS-90683 rejections, PR #52; parallel wave)
    - fix: gate speech-string removal on a binary check (otool/nm/strings of the EAS .ipa), source scan as first filter only
    - fix: ITMS-90683 only verifiable after merge; step 5 proves compile + symbol absence; reword the mic-string rationale (binary API references, not display)
    - fix: mic claim marked inferred → since established at source level (react-native-webview/apple); strings are plain ios.infoPlist entries (no plugin); npm ls before/after; PR flags the kept mic string for user veto
- [reviewed — folded] whole-proposal (first wave): Skeptic revise — binary check instead of source grep; criterion 6 could not fail; knowledge entry's open question unresolved; widen grep; Android manifest — folded (tier: reviewer; parallel wave)
- [reviewed — folded] whole-proposal (restart — approach fixes rewrote ## Success criteria): Skeptic revise — positive control for the binary scan (done on 959332ea: Speech.framework=1, SFSpeech undef=2, SFSpeechRecognizer strings=2); EAS FINISHED can't observe ITMS-90683 → criterion 6 reports it pending, user-owned; restore needs plist check not rebuild; same-inputs check verified vs merged; step 2 advisory; mic binary symbols into knowledge; wider grep incl. RecognitionService; record build ID (tier: reviewer; parallel wave restart)
- [rechecked — residual folded] whole-proposal: fold-audit accepted; residuals folded — dropped the "earlier signal from the PR dev build" claim; RecognitionService added to criterion 4; ITMS verdict owner = user; mic wording reconciled (source references established, binary symbols recorded by step 5)

## Work notes
- Worktree on origin/main 9e5cd06 (contains #59). Clean npm ci (token from ~/.npmrc per command, at the user's earlier direction).
- Binary-check positive control (pre-removal production build 959332ea, sha recorded below): main exe `SoberJourney`: Speech.framework=1, `nm -u` SFSpeech=2, strings SFSpeechRecognizer=2, mic-permission strings=2, AVF links=3; Frameworks/*: no Speech hits.
- Removal: `npm uninstall -w packages/app expo-speech-recognition expo-speech`; `git rm -r src/hooks/useSpeechToText`; dropped NSSpeechRecognitionUsageDescription. `npm ls --all --parseable` diff: removed exactly `node_modules/expo-speech`, `node_modules/expo-speech-recognition`; added nothing. Lockfile −22 lines.
- Source scan (advisory): speech patterns → no matches in ios/apple/react-native sources; mic patterns (informational) → `react-native-webview/apple` only.
- Gate: grep clean; root build ✓; tests 262/262 ✓; check:native-modules ✓ (49 entries; expo-speech no longer present); expo install --check ✓; lint 0 errors ✓; knip: lost exactly the two useSpeechToText files; exports ios/android/web ✓; prebuild ios ✓ (Info.plist keeps NSMicrophoneUsageDescription, no Speech key); prebuild android ✓ (0 RECORD_AUDIO / RecognitionService).
- Positive-control .ipa (959332ea) sha256 prefix: afc200080e605f9e
- Pre-PR EAS production build **0e376008-afa6-49f2-88d5-5acb2014ffcb** on f210001: **FINISHED** (build 102, not submitted). .ipa sha256 015e9f78a2de9ceab2a06575c45e269a8510a9446b762e7d2036266430b6f3e3.
- Binary check (full output: binary-check-0e376008.txt, every Mach-O = main exe + Frameworks/*): Speech.framework strong/weak = 0, `nm -u` SFSpeech = 0, `strings` SFSpeech = 0 everywhere. Positive control on 959332ea had Speech.framework=1 / SFSpeech=2 / 2 in the main exe → the scan discriminates. **NSSpeechRecognitionUsageDescription removal stands.**
- Microphone (informational): the record-permission strings (`requestRecordPermission|AVAudioApplication|recordPermission`) also dropped to 0 — the 2 hits in 959332ea came from expo-speech-recognition. react-native-webview's media-capture source references don't surface under those patterns (WKWebView media capture is mediated by WebKit). So the binary no longer evidences a direct mic API reference; NSMicrophoneUsageDescription is kept anyway on the PR #52 precedent (a source/dependency-level "nothing uses it" was wrong once; a kept unused string costs nothing). Recorded for a future evidence-based decision.
