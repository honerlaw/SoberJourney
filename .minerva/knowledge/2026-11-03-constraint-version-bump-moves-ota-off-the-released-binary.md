# A version bump moves OTA off the released binary; bump only when a native change needs a new store build

**Date**: 2026-11-03
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: The marketing version is part of the iOS fingerprint, so bumping it retargets every later EAS Update away from the live build; App Store releases close their version train, so bump only for a native change, and confirm submissions since eas.yml goes green first
**Context**: .minerva/work/2026-11-03-revert-to-1-2-0-stop-dev-submits (see git history if the worktree has been cleaned up)

## Context
On 2026-11-03 a rejected App Store Connect upload was read as a failed production submission of build 118, the first build with expo-updates. That reading led to #70, a bump to 1.2.1.

In fact:
- The user confirmed from App Store Connect that build 118 *is* the released 1.2.0.
- The rejected upload was development build 119 (1.2.0). PR #68's CI made it with `npm run eas:submit:dev` (`--auto-submit --profile development`), and App Store Connect refused it because the 1.2.0 train was closed.

The bump had moved main's fingerprint off 118's runtime (`239adbf6…` → `47106baf…`), so JS-only merges would have stopped reaching 1.2.0 users. It was reverted the same day, and production build 121 (1.2.1) was cancelled before submitting.

## Constraint
- **Releasing a version closes its train.** Once Apple approves or releases a marketing version, App Store Connect and TestFlight reject any further upload at that `CFBundleShortVersionString`. Past cases: build 78 at 1.1.0 (#47), and dev build 119 at 1.2.0. EAS manages the build number remotely (`appVersionSource: "remote"`); only `expo.version` sets the marketing version.
- **The version is fingerprinted** (`fingerprint.config.js` keeps it). A bump therefore makes the merge build and submit, and it moves every *later* EAS Update to the new runtime. Users on the released build stop receiving OTA until they install the new version.
  - Bump only when a native change needs a new binary anyway, because the released build can't take that change over the air.
  - A JS-only change should never come with a bump.
- **Bump recipe: five files, eight lines.**
  - root `package.json`;
  - `packages/app/package.json`;
  - `packages/app/app.json` `expo.version`;
  - `packages/server/package.json`;
  - four own-version lines in `package-lock.json`: top-level, `packages[""]`, `packages/app`, `packages/server`.

  Nothing in the code reads the version.
- **Check the decision before merging.** On one fresh `npm ci`, run `packages/app/scripts/eas-deploy.sh predict` twice:
  - main's files should print the live runtime and "Decision: update";
  - the change should print the decision you intend.
- **Which build is live.** Ask App Store Connect (the version's Build section) or the user. EAS build records carry no submission or release status. Production builds 108, 110, 116 and 118 were all 1.2.0. `eas update:insights <group>` shows whether an update group is being launched.
- **The submission result shows up only after eas.yml finishes.** eas.yml runs `eas build --auto-submit --no-wait`, so the job passes before the submission resolves. Confirm a production submission in EAS or App Store Connect.
  - If the rejection is one App Store Connect itself can fix, resubmit the same build: `eas submit --platform ios --id <build-id>`.
  - Hold other merges until a bumped production build is FINISHED; a merge in between starts a second build.
  - When creating the App Store version, attach the eas.yml production build.
- **PR CI no longer uploads dev builds.** ci.yml queues `eas build --profile development` without `--auto-submit`.
  - The development profile is `distribution: internal`, which per eas.json means ad hoc/development signing, and that is normally not TestFlight-eligible. Whether any dev upload ever reached TestFlight is unverified.
  - Install dev builds from the EAS internal-distribution link on registered devices.
  - To test JS changes without TestFlight, use an internal build plus `eas update --channel <its channel>`. TestFlight builds need a version above the released one, which is a bump, so they are only for native changes.

## Implications
- **The live hazard is a native change after a release with no bump (#69):**
  1. eas.yml builds at the released version.
  2. App Store Connect rejects it.
  3. The FINISHED build still becomes the update target.
  4. Every later JS-only merge publishes to a runtime nobody runs, and nothing reports it.

  Until #69 is fixed, any merge that changes the fingerprint needs a bump, or the merge must be held.
- After a bump merges, the released build's users stay on the last update published for its runtime.
  - **Emergency fix for them:** publish from the released commit: `APP_VARIANT=production eas update --channel production --platform ios --environment production`. Then confirm the published runtime is the live build's.
- **If a store binary turns out to have no expo-updates** (anything built before 5aa2541), no OTA path reaches it. Only a new store version does.

## Related
- [[2026-11-03-constraint-app-store-release-closes-its-version-train]] — supersedes
- [[2026-10-10-decision-eas-update-publish-on-merge-by-fingerprint]] — the update-vs-build rule; "A FINISHED build counts even if its submit failed"
- [[2026-11-03-constraint-app-fingerprint-covers-package-scripts-and-install]] — why ci.yml calls eas directly instead of editing the app's package.json scripts
- [[2026-10-06-reference-released-app-compatibility]] — the server stays additive-only while old binaries keep running
