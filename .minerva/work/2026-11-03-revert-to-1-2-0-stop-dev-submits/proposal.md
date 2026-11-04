# Proposal: revert-to-1-2-0-stop-dev-submits

**Date**: 2026-11-03
**Status**: Shipped (2026-11-03)

## Goal
Return main's app version to 1.2.0, so JS-only merges again publish EAS Updates to the released 1.2.0 binary (build 118). Stop PR CI uploading development builds to App Store Connect. Correct the records written from the wrong diagnosis behind #70.

## Why
- **The live build already takes updates.** The user confirmed that the live App Store 1.2.0 is **build 118** (`6c7b726a`, commit 5aa2541, with expo-updates, runtime `239adbf6321f8911c7c50247d7d75c6bc388afe4`). 1.2.0 users therefore already receive EAS Updates; #68's update group `a87f16da` targets their runtime.
- **The rejection was a dev build.** The "submission failed" the user saw was **development build 119**: 1.2.0, built at 00:01 today by PR #68's CI step `npm run eas:submit:dev` (`eas build --auto-submit --profile development`). App Store Connect rejected it because the 1.2.0 train is closed. No production submission failed.
- **#70 was based on that misreading.**
  - It bumped to 1.2.1, which moved main's iOS fingerprint to `47106baf…`. Every JS-only merge would now publish only to the unreleased 1.2.1 runtime, and 1.2.0 users would stop getting fixes until they upgrade.
  - The 1.2.1 binary would be build 118 plus #68's JS, which 1.2.0 users already get over the air, so releasing it gains nothing.
  - The user chose to revert. Production build 121 (1.2.1) was cancelled before it finished.
- **PR CI uploads every dev build.** It auto-submits a development-client build to App Store Connect on every PR. Once a version is released, every PR therefore produces a rejected-submission notice, and that notice started this confusion. The user chose to stop auto-submitting dev builds.
- **Two records repeat the wrong diagnosis.** `.minerva/knowledge/2026-11-03-constraint-app-store-release-closes-its-version-train.md` and GitHub issue #69 both say build 118 was rejected and that OTA reached no one.

## Approach
1. **Restore the version files from pre-#70 main.** Run `git checkout c4b13c1~1 -- package.json package-lock.json packages/app/package.json packages/app/app.json packages/server/package.json`. Between `c4b13c1~1` and `c4b13c1` those files differ only in the eight version lines, so this restores exactly 1.2.0 and nothing else. Don't use `git revert c4b13c1`: that squash commit also carries #70's work-unit record and knowledge entry, which stay as history.
   - **Why the fingerprint returns to `239adbf6…`.** Between `c4b13c1~1` and `c4b13c1`, the only other changes are under `.minerva/`, which sits outside the `packages/app` project and isn't fingerprinted. This unit also edits `.github/workflows/ci.yml` and `.minerva/`, neither of which is fingerprinted, and leaves the app `package.json` scripts unchanged.
   - **What the merge does.** Build 118 is still FINISHED, so the merge takes "Decision: update" and publishes a new update group to build 118's runtime with the same JS as #68's group `a87f16da`. No store build runs.
2. **PR CI queues the dev-client build without submitting.** Replace ci.yml's last step ("EAS Build and Submit", `npm run eas:submit:dev`) with a step named "EAS development build (no store submit)". It runs `eas build --non-interactive --platform ios --no-wait --profile development` with `working-directory: packages/app`; expo-github-action installs eas-cli globally, as the `predict` step already relies on.
   - With `--no-wait`, CI only proves the build was queued, as before.
   - The app's `package.json` scripts stay **unchanged**, because they are fingerprinted (`2026-11-03-constraint-app-fingerprint-covers-package-scripts-and-install`). The production path (`eas-deploy.sh` → `npm run eas:submit`) is untouched.
   - Dev builds use the `development` profile, which is `distribution: internal`. From eas.json, that means ad hoc/development signing, which App Store Connect normally refuses. It is unverified against App Store Connect's submission history whether any dev upload ever reached TestFlight. Either way, testers can install dev builds through the EAS internal-distribution link on registered devices.
3. **Correct the records without editing history.**
   - **Add a new constraint entry that supersedes `2026-11-03-constraint-app-store-release-closes-its-version-train`.** minerva's wiki is add-only: the derived catalog marks the old entry superseded through a `— supersedes` link. The new entry carries forward what is still true:
     - releasing a version closes its train (build 78 at 1.1.0, #47);
     - the five-file/eight-line bump recipe;
     - the `predict` control before merging;
     - hold merges until a bumped production build is FINISHED;
     - attach the eas.yml production build in App Store Connect.

     It adds the corrected facts:
     - the live 1.2.0 is build 118, as the user confirmed (build number from App Store Connect), so it can receive OTA; launch telemetry is still to confirm;
     - a version bump moves the OTA target off the released binary, so bump only when a native change needs a new binary;
     - EAS build records carry no submission or release status, so ask App Store Connect or the user which build is live;
     - `eas update:insights <group>` shows launches;
     - PR CI dev builds are `distribution: internal`, expected not to be TestFlight-eligible (unverified), and their auto-submit is now off; test JS changes via an internal build plus `eas update --channel <channel>`;
     - eas.yml goes green before the `--no-wait` submit resolves, so confirm a production submission in EAS or App Store Connect. If App Store Connect itself can fix a rejection, resubmit the same build with `eas submit --platform ios --id <build-id>`;
     - the real hazard: a native change merged after a release without a bump builds 1.2.0, App Store Connect rejects it, the FINISHED build becomes the update target, and 1.2.0 users silently stop getting OTA. This is tracked in #69.
   - **Retitle and rewrite #69** around that real hazard, and keep it open at priority high. Comment that its original premise (build 118 rejected) was false. A possible guard: `predict`/`deploy` fails when "Decision: build" and `expo.version` equals the live App Store version (public iTunes lookup).
   - The #70 work unit and the old entry stay as history. This unit's proposal and the superseding link record the correction.
4. **Ordering.** Hold other merges to main until this PR lands. Until then, main's fingerprint is 1.2.1/`47106baf`, and any merge would start a 1.2.1 store build.

## Success criteria
1. `git diff c4b13c1~1 -- package.json package-lock.json packages/app/package.json packages/app/app.json packages/server/package.json` is empty. The worktree install is a fresh `npm ci`, so it can't rewrite the lockfile.
2. **Fingerprint control.** `packages/app/scripts/eas-deploy.sh predict` on that install prints iOS production fingerprint `239adbf6321f8911c7c50247d7d75c6bc388afe4`, "Finished production builds with this fingerprint: 6c7b726a-…", "Decision: update". The PR's CI `predict` step prints the same decision.
3. **CI dev build.**
   - ci.yml's last step is named "EAS development build (no store submit)". It runs `eas build` with `--profile development` and without `--auto-submit`, in `packages/app`, and no workflow step invokes `eas:submit:dev`.
   - `git diff main -- packages/app/package.json package.json` shows no scripts change.
   - On the PR's CI run, that step's log has no "Scheduling iOS submission" line, and `eas build:list --platform ios --build-profile development --limit 1 --json` shows a new build with appVersion 1.2.0.
4. **Knowledge entry.** A new `.minerva/knowledge/` constraint entry links `[[2026-11-03-constraint-app-store-release-closes-its-version-train]] — supersedes`. The derived catalog (`knowledge_catalog.py`) reports the old entry as superseded. The new entry states the carried-forward and corrected facts in Approach step 3. The old entry's file is unchanged.
5. **#69.** It is retitled to the native-change-after-release hazard, its body is corrected (with a `**Failure scenario**:` line), it stays open, and it has a comment explaining the false premise.
6. **Build 121.** Production build 121 (1.2.1) is CANCELED with no submission (verified 2026-11-03).
7. **Post-merge.** The eas.yml run for the merge prints "Decision: update" and "Published update group … for runtime 239adbf6321f8911c7c50247d7d75c6bc388afe4".
8. **CI.** The CI commands pass locally (`check:native-modules`, `check:eas-node`, the privacy-helper check, `build`, `test`, `build:web`), and PR CI is green.

## Open questions
- The live-build fact rests on the user's statement that build 118 (not, for example, 116 from before expo-updates) is the released 1.2.0. As of about two hours after publish, `eas update:insights a87f16da` shows 0 launches. Confirm it post-merge with launches above 0 for the newest update group on runtime `239adbf6` (this merge publishes a newer group with the same JS, so check that one, not only `a87f16da`). If it turned out to be 116, #70's bump was right after all, and the bump is cheap to redo.

## Outcome
- **Version files** restored from `c4b13c1~1`. `predict` on a fresh `npm ci` gave `239adbf6321f8911c7c50247d7d75c6bc388afe4`, finished build `6c7b726a…`, "Decision: update".
- **ci.yml's last step** is "EAS development build (no store submit)". The app and root `package.json` scripts are unchanged; `eas:submit:dev` and `submit.development` remain but nothing calls them.
- **New entry** `2026-11-03-constraint-version-bump-moves-ota-off-the-released-binary` supersedes the 2026-11-03 version-train entry. It hedges the live-build fact pending launch telemetry, and records the shared dev/production build-number counter.
- **#69** was retitled to the native-change-after-release hazard and kept open at priority high, with a correction comment.
- **Build 121** (1.2.1) was CANCELED with no submission.

## Deferred work

- #69 — a native change merged after an App Store release, without a version bump, turns a rejected build into the OTA target (priority: high)

