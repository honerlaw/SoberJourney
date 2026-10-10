# Scratchpad: fix-ios-build-react-native-svg

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [reviewed — clean] scope check: one unit, one unphased PR (svg fix + drift guard + knowledge entry) (tier: reviewer — new CI check is a new cross-cutting contract, denies solo; no panel clause: additive, no existing-interface change; parallel wave). Noted, not load-bearing: bound the EAS wait, sanity-check the lockfile diff — folded as operational detail.
- [reviewed — clean] approach: A — lockfile vs expo bundledNativeModules check script + CI step, exact-version allowlist for async-storage; rejected B (expo-doctor/install --check only see direct deps — proven by PR #58), C (declare transitive modules, no guard — dominated), D (CI waits on EAS — 20+ min/PR, billing contract change; follow-up idea) (tier: reviewer — new tooling surface; parallel wave). Wording notes folded: guard limited to expo-listed packages; dev-vs-production assumption; parser edge cases; skip link/versionless entries.
- [reviewed — folded] whole-proposal: Skeptic flagged load-bearing gaps — scan every lockfile key incl. packages/app/node_modules and nested (not just hoisted); step 6 "wait on the PR's --no-wait dev build before auto-merge" not codifiable → native compile proven BEFORE the PR with a non-submitting EAS **production** build (--wait, 60-min bound, replan on failure); range forms are only exact/~/^ in SDK 57; allowlist keyed name@version across paths + stale-allowlist mutation; knip; install via package.json edit + npm install (not expo install on the stale checkout); new knowledge entry (tier: reviewer; parallel wave — approach/scope unchanged so no restart)
- [rechecked — residual folded] whole-proposal: fold-audit accepted (11/12 addressed); residuals folded — script header names expo's JS-only entries as a limit; pre-PR build must cover the final native-affecting state, re-run if package.json / lockfile / app.json change after it
- [solo] review triage: 4 FIX (#1 main() guard silently skips the check when argv[1] isn't the realpath — CI silent-pass risk; #2 dead `satisfies` export; #3 npm aliases skipped — use entry.name; #4 header: ranges come from the installed expo) / 0 SUGGEST / 0 IGNORE (tier: default-solo row — every finding had one defensible disposition; minerva audit: diff matches approach, no knowledge tension)
- [panel — 3/3 accept, 1 with fixes] divergence confirmation: pre-PR EAS production build 9187da96 compiled past RNSVG but failed in expo-speech-recognition 3.0.1 → load-bearing divergence, replan (tier: panel floor; quorum 2/3)
    - fix (skeptic/arbiter): scan = risk reducer, EAS re-run = proof; check prebuild/exports + app.json plugin options; voice-input removal as an Open Question; amend criteria 1 and 7; note guard-extension considered and left out
- [panel — 3/3 accept, 3 with fixes] new-plan acceptance (replan 2026-10-10): bump expo-speech-recognition to ~57.1.1, re-run fresh-install gate + pre-PR EAS production build, replan again on a further native failure (tier: panel floor; quorum 3/3)
    - fix: cite unused-hook evidence (grep: only the hook's own files; knip baseline); define the scan precisely (command, dirs, three patterns; heuristic)
    - fix: 60-minute bound + report-to-user carry over to the re-run; criterion 7 = declared ~57.1.1, locked ≥57.1.1 <57.2.0; criterion 1 covers both packages
    - fix: removal of the unused hook/package recorded as an Open Question; knowledge entry notes peer deps `*` → manual bump per SDK; app.json has no plugin for the package
- [reviewed — clean] completion verification: Verifier reproduced criteria 1, 2, 5, 7 (and 3's CI step, 4 partially); 3-green and 6 pending by design → accept (tier: reviewer floor — Verifier; no interface change beyond the approved proposal)
- [solo] review triage (final diff): 4 FIX (#1 stale allowlist entry now fails; #2 ^0.0.z semver branch; #3 built-in self-check of the range logic on every run — in-script so package.json isn't touched (EAS re-run rule); #4 criteria renumbered) / 0 SUGGEST / 0 IGNORE (tier: default-solo row — every finding had one defensible disposition)
- [solo] promote partition: 1 PROMOTE (bug entry transitive-native-modules-broke-sdk-57-ios-build: root causes, guard + limits, EAS-build-before-merge lesson) / MERGE INTO PROPOSAL (Goal + Approach rewritten to what shipped incl. the speech-recognition replan) / DISCARD (disk-full, npm 401 + token plumbing, knip stash mishap, EAS log decoding) (tier: default-solo row — no entry with two defensible buckets)
- [solo] TODO disposition: 0 fix-now / 0 issues / voice-input removal → standing fact in the bug entry + Open Question in proposal and PR (product decision, no failure scenario); option D (CI waits on EAS) and guard extension → recorded as out-of-scope in proposal (no failure scenario; below the bar) (tier: default-solo row)

## Work notes
- Disk filled mid-run (ENOSPC on npm ci); user freed space. Then the shell's `NPM_TOKEN` was rejected (401 — the private `@onerlaw/framework` tarball had only ever come from the npm cache). User ran `npm login`; at the user's direction installs here read the login token from `~/.npmrc` into `NPM_TOKEN` per command (never printed). The user still needs to update their profile's `NPM_TOKEN`.
- Clean `npm ci` on b88180d reproduced react-native-svg 15.15.1. Declared `"react-native-svg": "15.15.4"` → lockfile diff = svg entry + `peer` flags dropped on its own deps (now direct); `npm ls` shows a single deduped 15.15.4.
- `scripts/check-native-module-versions.mjs`: 50 lockfile entries checked on the fixed lockfile, exit 0. Scans root, workspace-local (`packages/app/node_modules/expo-router`, `…/expo-router/node_modules/@expo/ui`, `…/@react-native-masked-view/masked-view`, `packages/app/node_modules/expo-server`) and nested (`node_modules/expo/node_modules/expo-modules-core`, `…/expo-server`) keys. Mutations: (a) svg 15.15.1 → exit 1; (b) allowlist entry removed → exit 1; (c) async-storage 1.24.1 → exit 1. Parser: 11 cases (exact, ~, ^ incl. ^0.x, prerelease → null, `>=` → null), 0 failures.
- CI: step after `npm ci` in ci.yml.
- knip ignores all dependencies (`ignoreDependencies: [".*"]`), so it never flags svg; it did flag the new script as an unused file → `"entry": ["scripts/*.mjs"]` in knip.json; that was the only change in knip output (other findings pre-existing, in untouched files).
- Fresh-install gate: expo config --json ✓, expo install --check ✓, root build ✓, tests 262/262 ✓, lint 0 errors ✓, exports ios/android/web ✓, prebuild -p ios ✓; no untracked files enter the diff.

## Review triage 2026-10-10
Code review (local-diff mode, fresh-context subagent). Minerva audit inline: spec fidelity — diff implements Approach steps 1–3 as approved; knowledge — consistent with 2026-10-10-reference-expo-sdk-57-upgrade-notes.
1. [medium] `main()` guard compared `path.resolve(argv[1])` to the module's realpath → via a symlinked path the script exited 0 silently → FIX: guard and export removed; `main()` always runs (verified: symlinked run with a missing lockfile now exits 1).
2. [low] dead `export function satisfies` → FIX (with #1).
3. [low] npm alias entries (`node_modules/<alias>` with `name`) were not checked → FIX: `entry.name ?? keyName` (verified with a synthetic alias entry).
4. [low] expected ranges come from installed expo, not the lockfile's → FIX: header note (CI runs right after npm ci).
After fixes: real lockfile exit 0 (50 entries); mutations a/b/c exit 1; prettier clean; knip unchanged (7 pre-existing unused files). No native-affecting file changed → the in-flight EAS production build still covers the final native state.
- Pre-PR EAS production build 9187da96 (2e99ffd): ERRORED — RNSVG compiled (247 compile lines, no svg error); failed at expo-speech-recognition 3.0.1 `ExpoSpeechRecognitionModule.swift:118` (legacy permissions API with `promise.resolver`). The merge's own production build ae9fda74 (b88180d) ERRORED on the RNSVGImage.mm error as predicted.
- expo-speech-recognition bumped `^3.0.1` → `~57.1.1` (lockfile 57.1.1; diff 4 lines). tsc ✓, check:native-modules ✓, lint 0 errors ✓, exports ios/android/web ✓, prebuild -p ios ✓. app.json has no plugin entry for it.
- Pre-PR EAS production build **959332ea-7576-4066-91f9-c3413fc8046c** on 0f3fad0: **FINISHED** (remote build number 99; not submitted). Criterion 5 satisfied. Later commits must not touch package.json / lockfile / app.json (re-run rule).

## Review triage 2026-10-10 (final diff)
Fresh code review over the final diff: lockfile confirmed (svg + speech-recognition only, plus svg's peer-flag fallout); speech-recognition 57.1.1 JS API matches every call in useSpeechToText (types checked); autolinking confirms async-storage is not linked on iOS.
1. [low] stale allowlist entry stays silently → FIX: unmatched allowlist entries fail the check (verified with async-storage at 2.2.0 → exit 1).
2. [low] `^0.0.z` treated like `^0.y.z` → FIX: exact-patch branch.
3. [low] no committed tests → FIX: `selfCheck()` runs 13 range cases on every invocation (a sabotaged case makes the script fail).
4. [low] criteria 6/7 out of order → FIX: renumbered.
After fixes: real lockfile exit 0 (50); a/c/alias exit 1; knip unchanged; only the script changed (no package.json/lockfile/app.json → EAS 959332ea still covers the native state).
