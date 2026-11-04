# Proposal: bump-app-version-1-2-1

**Date**: 2026-11-03
**Status**: Shipped (2026-11-03)

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
What shipped (commit `chore: bump to 1.2.1`):
- **Version 1.2.0 → 1.2.1, in the same five files and eight lines as #47:**
  - root `package.json`;
  - `packages/app/package.json`;
  - `packages/app/app.json` `expo.version`;
  - `packages/server/package.json`;
  - the four own-version lines in `package-lock.json` (top-level, `packages[""]`, `packages/app`, `packages/server`), edited directly. `npm ci --dry-run` accepts the result.
- **Why 1.2.1, not 1.3.0.** 1.2.1 is what the user was told. The 1.3.0 case rested on Expo SDK 57 / Liquid Glass / voice removal being unreleased, which EAS can't confirm: builds 108, 110 and 116 also finished at 1.2.0. Shipping 1.2.1 keeps 1.3.0 available later.
- **Build number.** EAS manages it (`appVersionSource: "remote"`, production `autoIncrement`). No source file reads the version, and Sentry takes it from the native bundle.
- **Fingerprint control, on one fresh `npm ci`:**
  - main's version files: `predict` printed `239adbf6321f8911c7c50247d7d75c6bc388afe4`, finished build `6c7b726a…`, "Decision: update";
  - the bump: `47106bafcf4cae81c6d36036fff776b0275a6460`, "No finished production build has this fingerprint.", "Decision: build".

  The merge therefore runs `npm run eas:submit` (`eas build --auto-submit --no-wait`).
- **Out of scope, filed as #69.** `eas-deploy.sh` treats a FINISHED-but-rejected build as an update target, and eas.yml goes green before the `--no-wait` submit has a result. That is how the 1.2.0 rejection went unnoticed.
- **PR CI side effect.** `ci.yml` runs `npm run eas:submit:dev`, so the PR may upload a 1.2.1 development-client build to the same App Store Connect app.
- **Manual steps after merge (user):**
  1. Hold other merges to main until `eas build:list --platform ios --build-profile production --status finished` shows the 1.2.1 build. A merge before then starts a second build and submit.
  2. Confirm the App Store Connect submission succeeded. eas.yml's result doesn't show it.
  3. If App Store Connect rejects it for a reason fixable there, resubmit the same build: `eas submit --platform ios --id <build-id>`. If the binary needs a change, fix it and bump the patch again, even for a JS-only fix.
  4. Create the 1.2.1 App Store version and submit it for review. Attach the production build from eas.yml, never a development-client build from PR CI.

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

## Deferred work

- #69 — eas-deploy.sh publishes OTA updates to a build whose App Store submission failed (priority: high)
