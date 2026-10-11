# Proposal: eas-update-ota

**Date**: 2026-10-10
**Status**: Draft

**Seed:** "how can we integrate with expo updates, so we don't need an app release to update the app" → user chose: publish on merge.

## Goal
Ship JS/asset-only changes to the iOS app over the air with EAS Update.
- **When a matching build exists.** Every merge to `main` publishes an update to the `production` channel if a FINISHED production build with the same native fingerprint already exists.
- **Otherwise.** It falls back to today's store build plus auto-submit.
- **Who can receive updates.** Builds that predate this change never receive updates. The first production build that contains expo-updates (cut by this PR's merge) bootstraps it.

## Why
- **Every fix waits on a release today.** Every merge to main runs `eas build --auto-submit` (eas.yml), so even a one-line JS fix waits on a ~20 min build plus App Store review.
- **Nothing is set up yet.** `expo-updates` is not installed, and app.json has no `updates` or `runtimeVersion`. No `ios/` or `android/` directory is committed (CNG only).
- **Native safety matters here.** The repo had three native/toolchain breaks on 2026-10-10:
  - [[2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build]]
  - [[2026-10-10-bug-un-hoisted-expo-router-broke-production-web-export]]
  - [[2026-10-10-bug-eas-default-node-rejected-npm-11-lockfile]]

  Updates must therefore never reach a binary whose native code differs, which is why the runtime policy is `fingerprint`.
- **Fingerprint measurements.**
  - A fresh `npm ci` of main (fb79f3c) on macOS gives fingerprint c29868dd…, identical to production build 116's recorded fingerprint. This holds only when `NODE_ENV`/`APP_VARIANT` are unset.
  - With `NODE_ENV=production` the hash becomes 69c53de…. `eas fingerprint:compare` shows the only difference is the evaluated `extra.apiUrl` (`localhost:3000` vs prod): `expo config` defaults `NODE_ENV` to development, and app.config.ts derives `apiUrl` from it.
  - With a `fingerprint.config.js` that skips `ExpoConfigExtraSection`, the hash is identical with and without the env, and identical for the production and development profiles.
  - Linux (GitHub runner) parity has not been measured.
- **Expo's packaged action isn't usable.** The README of Expo's `continuous-deploy-fingerprint` action says it is "not yet ready for use".
- **The CLI covers what's needed.** eas-cli 24.12.1 provides:
  - `fingerprint:generate`;
  - `build:list --fingerprint-hash --build-profile --status --limit`;
  - `update --channel --platform --environment --json --rollout-percentage` (`--environment` is required on SDK ≥55);
  - `update:rollback`, `update:republish` and `update:roll-back-to-embedded`.

## Approach
1. **Install and configure expo-updates.**
   - Add `expo-updates` at SDK 57's `bundledNativeModules.json` version (`~57.0.25`).
   - Add `packages/app/fingerprint.config.js` with `sourceSkips: ["ExpoConfigExtraSection"]`.
     - **Why it's safe:** `extra` is read only by JS (`Constants.expoConfig.extra`), and every update ships its own `extra` in its manifest.
     - **What it buys:** the runtime fingerprint is independent of `NODE_ENV`/`APP_VARIANT`, so CI, `eas update` and EAS Build hash the same native inputs.
   - In app.json:
     - `"updates": {"url": "https://u.expo.dev/f79c97c3-d0dd-43d0-bc42-a766540bee2b", "checkAutomatically": "ON_LOAD", "fallbackToCacheTimeout": 0}`;
     - `"runtimeVersion": {"policy": "fingerprint"}`.
   - **Behavior.** The app checks on launch and never blocks launch. A downloaded update applies on the next cold start. If an update fails to launch, expo-updates falls back to the previous working update, or to the embedded bundle.
   - **No restart prompt.** There is no in-app "restart to update" prompt in this unit.
2. **eas.json channels.** development → `development`, preview → `preview`, production → `production`. The existing `node` pins stay.
3. **`packages/app/scripts/eas-deploy.sh <predict|deploy>`** (bash, `set -euo pipefail`, iOS only):
   - **Fingerprint.** Compute `PROD_HASH` from `eas fingerprint:generate --platform ios --build-profile production --json --non-interactive | jq -er .hash`. `--build-profile` and `--environment` are mutually exclusive on 24.12.1; this was verified.
   - **Find a compatible build.** Run `eas build:list --platform ios --build-profile production --fingerprint-hash "$PROD_HASH" --status finished --limit 10 --json --non-interactive`. Compatible means there is at least one FINISHED build; the script logs the matching build IDs.
   - **Builds that don't count.** In-flight, errored and canceled builds do not count; they fall through to build + submit.
     - Tradeoff: a merge landing during an in-flight native build starts another build. That is today's behavior, and costs a build.
     - A FINISHED build whose submit later failed, or that App Review rejected, would still count. Updates then wait until that binary ships, or are superseded by the next native build. This is accepted and documented, because submission status is not exposed by `build:list`.
   - **Fail closed.** Any non-zero exit or empty/invalid JSON from `fingerprint:generate` or `build:list` fails the job visibly. It never falls through to `eas update` and never to a surprise submit.
   - **`deploy` with a compatible build:**
     1. Export `APP_VARIANT=production` for the whole script. `eas update` evaluates app.config.ts with expo's development default for `NODE_ENV`, which would otherwise resolve `extra.apiUrl` to localhost; the smoke test caught exactly that. Assert that `npx expo config --type public --json | jq -r .extra.apiUrl` equals `https://www.soberjourney.app` (the same evaluation path as `eas update`), and fail otherwise.
     2. Run `eas update --channel production --platform ios --environment production --message "$MESSAGE" --json --non-interactive`. `$MESSAGE` is the quoted commit subject plus short SHA; it may summarize skipped commits because concurrency keeps only the newest pending run.
     3. Assert that the published `runtimeVersion` equals `$PROD_HASH`. Fail loudly if not: that means the update went to a runtime with no build, which is safe but unreachable.
     4. Read `extra.apiUrl` back from the published manifest (`https://u.expo.dev/update/<id>`, multipart). If it is not the production URL, fail and print the `eas update:rollback <group>` command.
   - **`deploy` without a compatible build.** Run `npm run eas:submit` (today's production build with auto-submit, `--no-wait`).
   - **`predict`.** Prints `PROD_HASH`, the matching builds and the decision. It also prints the iOS **development**-profile fingerprint, for the parity check. It acts on nothing.
4. **Workflows.**
   - **eas.yml (push to main).** Replace `npm run eas:submit` with `eas-deploy.sh deploy`, under `concurrency: {group: eas-deploy, cancel-in-progress: false}`.
   - **ci.yml (PR).** Add an `eas-deploy.sh predict` step after Build and before the EAS dev build step. It fails on tooling errors, like deploy would.
   - **eas-cli version.** Pin it in both workflows to `24.12.1` (was `latest`), because the script depends on its flags.
5. **Knowledge.** A new entry covering:
   - the bootstrap rule (existing binaries never get OTA; updates reach users only after the first expo-updates binary is released, then on relaunch);
   - the fingerprint safety argument and its accepted false-negative surface (EAS image/Xcode, env-dependent config — mitigated by the apiUrl assertion);
   - the rollback runbook (`eas update:rollback <groupId>`, `eas update:republish --group <previous>`, `eas update:roll-back-to-embedded`, and `--rollout-percentage` for cautious releases);
   - the ordering rule: OTA can reach users minutes after merge, so the server stays additive-only and any endpoint must already be deployed before JS relies on it;
   - the measured CI-vs-EAS parity.

   It also covers:
   - **Rollback caveats.** `update:rollback <groupId>` works only if that group is the latest on its branch and runtime. `--rollout-percentage` belongs to `eas update`/`update:republish`, not to rollback.
   - **Manual hotfix check.** A manual escape-hatch update must confirm its published `runtimeVersion` equals the released build's fingerprint.
   - **The `extra` convention.** Never put native-affecting config in `extra`, because it is excluded from the fingerprint.
   - **Spotting broken parity.** If eas.yml takes the build path on JS-only merges, check fingerprint parity.

   It links [[2026-10-06-reference-released-app-compatibility]], which still holds for pre-OTA binaries.

Alternatives:
- **B: `continuous-deploy-fingerprint` action.** Rejected: not ready for use.
- **C: EAS Workflows.** Rejected for now: it moves deploy off GitHub Actions and its guards, and needs the Expo GitHub app.
- **D: always build + update.** Rejected: it keeps the release wait.
- **E: manual updates only.** Rejected: the user chose publish-on-merge.

## Success criteria
1. **Installation and config.**
   - `expo-updates` is a packages/app dependency at the SDK 57 version.
   - `npm run check:native-modules` and `npm run check:eas-node` pass.
   - app.json has `updates` (url, ON_LOAD, timeout 0) and the fingerprint `runtimeVersion`.
   - Every eas.json build profile has its `channel`.
   - `packages/app/fingerprint.config.js` is committed and applied: the hash with it differs from the hash with it temporarily removed, and with it the hash is the same with and without `NODE_ENV=production`.
2. **Existing CI still passes.** Root `npm run build` and `npm run test`, and the production web export (`build:web`), all pass in PR CI.
3. **Lookup and predict.**
   - `eas build:list --platform ios --build-profile production --fingerprint-hash c29868ddc5577c7add8c87ee9ce26f8b919ec773 --status finished --json` returns build 116 (the lookup works for a known fingerprint).
   - On this branch, after a fresh install, `eas-deploy.sh predict` reports decision `build`, because expo-updates changed the fingerprint.
   - That `predict` run executes the real `fingerprint:generate` and `build:list` commands.
   - `predict` exits non-zero when `eas` is unavailable or `build:list` fails. Test this with a PATH that has no `eas`.
   - The hash is the same with `NODE_ENV=production` set and with it unset.
4. **Update path smoke test, run from the worktree before the PR.**
   - Publish to the throwaway EAS Update branch `ota-smoke-test`, which no channel points to, so no device can receive it. Use `eas update --branch ota-smoke-test --platform ios --environment production --json` with NODE_ENV/APP_VARIANT=production.
   - It succeeds, its `runtimeVersion` equals the branch's `PROD_HASH`, and the published update's manifest `extra.apiUrl` is the production URL, read from the update itself (for example `eas update:view --json` or the manifest), not from `expo config`.
   - Delete the branch afterwards.
5. **Workflow wiring.**
   - eas.yml calls `eas-deploy.sh deploy` under the non-cancelling concurrency group, with eas-cli pinned to 24.12.1.
   - ci.yml runs `predict` before the EAS dev build step.
   - PR CI is green.
6. **Parity gate, before auto-merge.**
   - This PR's CI-queued EAS iOS development build reaches `finished`.
   - Its recorded fingerprint equals both fingerprints that `predict` printed on the Linux runner, development and `PROD_HASH`; they are equal by measurement. This proves Linux-runner/EAS parity for the hash that production deploys use.
   - Its config shows `channel: development` and a fingerprint `runtimeVersion`.
   - **If parity fails:** don't merge as is; replan (for example, compute the fingerprint on EAS instead). Production-profile parity is observed only after merge (see Open Questions). A mismatch there costs only an unneeded rebuild per merge.
7. **Knowledge entry** as in Approach step 5.

## Accepted limitations (documented in the knowledge entry)
- **Unreleased native changes block OTA hotfixes.** Once a native-affecting change merges, main's fingerprint has no released binary. JS merges then publish to that unreleased runtime and reach nobody until the new build ships. Users on the released binary cannot get a fix from main in that window.
  - Escape hatch: check out the released commit (whose fingerprint equals the released build), apply the fix, and run `eas update --channel production --platform ios --environment production` manually.
  - Keep main releasable.
- **Server/OTA race.** OTA reaches users minutes after merge, while DigitalOcean deploys the server on its own pipeline. JS that needs a new endpoint must merge after that endpoint is deployed. This is a rule, not a gate.
- **No update code signing.** It is out of scope: a CI or `EXPO_TOKEN` compromise could publish arbitrary JS. EAS Update code signing is a possible follow-up.
- **Repeated builds.** A merge during an in-flight native build starts another build and submit. A FINISHED build whose submit failed or was rejected still counts.
- **Fingerprint false negatives.** Changes to the EAS image or Xcode are not fingerprinted.

## Open Questions
- **Post-merge.** eas.yml should take the build path, so build 117 builds and submits. Once 117 is released, the next JS-only merge should publish an update and print a `PROD_HASH` equal to 117's fingerprint. This is reported, not a pre-merge criterion.
- **EAS Update billing.** It is metered by monthly active users (MAU) on the onerlawllc plan; that is the user's call.
- **Staged rollouts.** `--rollout-percentage` is available but not used. Every update goes to 100%, as the user asked; this is documented in the runbook.
- **In-app "update ready" prompt.** Deferred.
