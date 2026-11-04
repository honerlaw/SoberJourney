# Proposal: bump-app-version-1-2-1

**Date**: 2026-11-03
**Status**: Draft

## Goal
Bump the app's marketing version from 1.2.0 to 1.2.1, so the next merge to main takes `eas-deploy.sh`'s build-and-submit path with a marketing version App Store Connect will accept. Acceptance itself is a post-merge check (manual step 2).

## Why
- The user reports that the App Store submission failed because the 1.2.0 version train is closed (1.2.0 is already released).
- Production build 118 (`6c7b726a`, commit 5aa2541, appVersion 1.2.0, the first build with expo-updates) finished, but its auto-submit was rejected.
- Build 118 is the only finished production build at runtime fingerprint 239adbf6. No store binary therefore carries expo-updates, and the EAS Update published after #68 reaches no installed app.
- Until a new binary is accepted and released, every JS-only merge publishes an update to a runtime nobody runs (knowledge: "A FINISHED build counts even if its submit failed").
- This plan assumes the rejection was the closed-train error (ITMS-90186/90062), as in #47. If it was something else, the bump alone won't fix it; see manual step 3.
- Production builds 108, 110 and 116 also finished at 1.2.0. EAS records don't show which 1.2.0 build Apple released, so the release may or may not already include Expo SDK 57 / Liquid Glass (#58) and the voice removal (#60).

## Approach
- **Bump in the places the previous two bumps touched** (#47 `5f97eff` 1.1.0→1.2.0, `62c44e1` →1.1.0):
  - root `package.json`;
  - `packages/app/package.json`;
  - `packages/app/app.json` (`expo.version`);
  - `packages/server/package.json`;
  - the four own-version lines in `package-lock.json`: top-level `version`, `packages[""]`, `packages/app`, `packages/server`. The two `"link": true` workspace entries carry no version.
- **Only those version lines change.** Edit them directly, not with a lockfile regeneration that could drift other entries.
- **Why 1.2.1.**
  - It is what the user was told, and it clears the closed train.
  - The case for 1.3.0 rested on SDK 57 / Liquid Glass / voice removal being new since the release, and that can't be confirmed (see Why).
  - Shipping 1.2.1 keeps 1.3.0 available later, but not the other way round. The user can still pick 1.3.0 before merge.
- **Build number.** EAS manages it (`appVersionSource: "remote"`, production `autoIncrement: true`), so nothing else changes.
- **Effect on the fingerprint.** `fingerprint.config.js` fingerprints `version`, so the bump yields a new iOS fingerprint with no finished build. The merge then takes "Decision: build" → `npm run eas:submit` (`eas build --auto-submit --no-wait`).
- **Out of scope: `eas-deploy.sh`'s update target.** It treats a FINISHED-but-unsubmitted build as an update target, and eas.yml goes green before the `--no-wait` submit has a result, so rejected submits go unnoticed.
  - That rule is documented as accepted behaviour in `2026-10-10-decision-eas-update-publish-on-merge-by-fingerprint`. Gating on submission or release status needs EAS/ASC status queries and is a separate design.
  - It doesn't block this fix: the new fingerprint has no finished build at all.
  - Disposition: promote files it as a GitHub issue with its failure scenario (a rejected submit → every later JS merge publishes OTA to no installed binary, silently).
- **PR CI side effect.** `ci.yml` runs `npm run eas:submit:dev` (a development-profile build with `--auto-submit` to the same ASC app). The PR itself may therefore put a 1.2.1 dev-client build into App Store Connect before main's production build. Whether App Store Connect accepts that internal-distribution upload is unverified. The remote build-number counter keeps the production build's number distinct.
- **Manual steps after merge (user):**
  1. Hold other merges to main until `eas build:list --platform ios --build-profile production --status finished` shows the 1.2.1 build. eas.yml goes green within minutes because of `--no-wait`, so its result is not the signal. A merge before then starts a second build and submit (wasteful, not harmful).
  2. Confirm the EAS build and its App Store Connect submission succeeded. eas.yml returns before the submit, because of `--no-wait`.
  3. If the submission is rejected for a reason fixable in App Store Connect, resubmit the same build: `eas submit --platform ios --id <build-id>`. If the binary needs a change, fix it and bump the patch again. Bump even for a JS-only fix: once the 1.2.1 build is FINISHED, an unbumped merge takes the update path and publishes OTA to the unreleased runtime instead of building.
  4. Create the 1.2.1 App Store version and submit it for review. Attach the production build (match its number to the eas.yml run's build), never a development-client build from PR CI.

## Success criteria
1. Root `package.json`, `packages/app/package.json`, `packages/app/app.json` `expo.version` and `packages/server/package.json` read `1.2.1`. No own-version `1.2.0` remains in those files.
2. `git diff main -- package-lock.json` changes exactly the four own-version lines (top-level, `packages[""]`, `packages/app`, `packages/server`), from 1.2.0 to 1.2.1, and nothing else.
3. Fingerprint control on one fresh install, running `packages/app/scripts/eas-deploy.sh predict` twice:
   - with main's version files restored: iOS production fingerprint `239adbf6321f8911c7c50247d7d75c6bc388afe4`, "Decision: update";
   - with the bump applied: a different fingerprint, "Decision: build".

   The PR's CI `predict` step (the ubuntu runner, eas-cli 24.12.1, the same environment as eas.yml) also prints "Decision: build". If the local control can't reproduce `239adbf6` because of a toolchain difference, the CI line is the deciding evidence and the local mismatch is recorded.
4. The CI commands pass locally: `check:native-modules`, `check:eas-node`, the privacy-helper check, `build`, `test`, `build:web`. The PR's CI run is green.

## Open questions
- 1.2.1 vs 1.3.0 is the user's call. 1.2.1 is the stated default, and either clears the closed train. Overriding it before merge is a one-line change per file.
