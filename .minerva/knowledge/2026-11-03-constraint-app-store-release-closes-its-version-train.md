# Releasing an App Store version closes its train; the next store build needs a version bump

**Date**: 2026-11-03
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: Once Apple releases a marketing version, uploads at that version are rejected (ITMS-90186/90062); bump app.json + package versions before the next store build, and check the submission, since eas.yml goes green before it
**Context**: .minerva/work/2026-11-03-bump-app-version-1-2-1 (see git history if the worktree has been cleaned up)

## Context
This has happened twice:
- Build 78 was rejected because 1.1.0 was approved and its train closed. Fixed by #47, the bump to 1.2.0.
- Build 118 (2026-10-11, the first build with expo-updates) was rejected because 1.2.0 had been released.

The second time went unnoticed for three weeks. eas.yml runs `eas build --auto-submit --no-wait`, so the job passed, and every later merge published an EAS Update to build 118's runtime, which no installed app had.

## Constraint
- **App Store Connect accepts builds only while the version's train is open.** After a version is approved or released, any upload at that `CFBundleShortVersionString` is rejected. The build number doesn't help: EAS manages it remotely (`appVersionSource: "remote"`, `autoIncrement`), and only `expo.version` sets the marketing version.
- **A bump is a version-string change in five files, eight lines** (see #47 and `chore: bump to 1.2.1`):
  - root `package.json`;
  - `packages/app/package.json`;
  - `packages/app/app.json` `expo.version`;
  - `packages/server/package.json`;
  - four own-version lines in `package-lock.json`: top-level, `packages[""]`, `packages/app`, `packages/server`. The workspace `"link": true` entries carry no version.

  Nothing in the code reads the version. Sentry takes it from the native bundle.
- **The bump changes the iOS fingerprint** (`fingerprint.config.js` keeps `version`). The merge therefore always takes `eas-deploy.sh`'s build-and-submit path. Check this before merging: run `eas-deploy.sh predict` on main's files and then on the bumped files, on one fresh install. Main should print the known fingerprint with "Decision: update"; the bump should print a new one with "Decision: build".
- **eas.yml's result is not the submission's result.** Because of `--no-wait`, confirm the submission in EAS or App Store Connect after the build finishes. Until a submission succeeds, OTA updates published by later merges reach no one (#69).

## Implications
- After Apple releases a version, bump the patch on main before (or with) the next merge that needs to reach the store. Otherwise that merge's build is rejected.
- Hold other merges until the bumped production build is FINISHED. A merge in between starts a second build and submit.
- After a rejection that App Store Connect itself can fix, resubmit the same build: `eas submit --platform ios --id <build-id>`. If the binary needs a change, bump again, even for a JS-only fix. Once the rejected build is FINISHED, an unbumped merge takes the update path instead of building.
- PR CI's `eas:submit:dev` also uploads development-client builds to the same App Store Connect app. When creating the App Store version, attach the production build that eas.yml produced.

## Related
- [[2026-10-10-decision-eas-update-publish-on-merge-by-fingerprint]] — the update-vs-build rule this feeds; "A FINISHED build counts even if its submit failed"
- [[2026-11-03-constraint-app-fingerprint-covers-package-scripts-and-install]] — how to compare fingerprints reliably
- [[2026-10-06-reference-released-app-compatibility]] — older binaries keep running while a new version waits on review
