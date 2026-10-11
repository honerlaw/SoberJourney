# Proposal: eas-update-ota

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)

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

What shipped:
1. **expo-updates 57.0.25.** This is SDK 57's bundled version; the earlier `~29.0.15` came from a stale SDK-54 `node_modules`.
   - app.json: `runtimeVersion: {policy: "fingerprint"}`, plus `updates: {url: https://u.expo.dev/<projectId>, checkAutomatically: ON_LOAD, fallbackToCacheTimeout: 0}`.
   - eas.json: every build profile has a `channel` of the same name.
2. **`packages/app/fingerprint.config.js`.** It skips `ExpoConfigExtraSection` and keeps the default `PackageJsonAndroidAndIosScriptsIfNotContainRun`, so the runtime hash no longer depends on `NODE_ENV`/`APP_VARIANT`. Production and development profiles hash identically.
3. **`packages/app/scripts/eas-deploy.sh <predict|deploy>`** (iOS, `set -euo pipefail`, exports `APP_VARIANT=production`):
   - **Lookup.** `fingerprint:generate --build-profile production`, then `build:list --fingerprint-hash --status finished --limit 10`.
   - **No finished build:** `deploy` runs `npm run eas:submit`.
   - **A finished build:** `deploy` runs these steps:
     1. pre-checks `extra.apiUrl`;
     2. runs `eas update --channel production --platform ios --environment production --message=<subject (sha)> --json`;
     3. asserts that the published `runtimeVersion` equals the looked-up hash;
     4. reads `extra.apiUrl` back from `manifestPermalink`, with retries. On any mismatch it prints `eas update:rollback <group>`.
   - **`predict`** prints both fingerprints and the decision.
4. **Workflows.**
   - eas.yml runs `deploy` under `concurrency: eas-deploy` (non-cancelling).
   - ci.yml runs `predict` before the EAS dev build.
   - Both pin eas-cli to 24.12.1.
5. **Knowledge:** [[2026-10-10-decision-eas-update-publish-on-merge-by-fingerprint]].

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
   - The runtime version that the **macOS builder** resolved and embedded equals both fingerprints that `predict` printed on the Linux runner (development and `PROD_HASH`, which are equal by measurement). The builder's value is read from its build log, phase `CALCULATE_EXPO_UPDATES_RUNTIME_VERSION`, with no runtime-version mismatch warning.
     - The build record's own fingerprint is not enough: it is computed by eas-cli on the machine that queued the build, i.e. the same Linux runner.
     - This proves the hash that deploys look up is the runtime that binaries actually accept.
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
