# Merges to main ship over the air when a finished build shares the native fingerprint

**Date**: 2026-10-10
**Type**: decision
**Theme**: app-infrastructure
**Summary**: eas.yml publishes an EAS Update when a FINISHED production build has main's iOS fingerprint, else builds and submits; extra is excluded from the fingerprint
**Context**: .minerva/work/2026-10-10-eas-update-ota (see git history if the worktree has been cleaned up)

## Context
The user wanted app fixes to ship without an App Store release, and chose to publish on every merge to main. Before this, every merge ran `eas build --auto-submit`. Expo's `continuous-deploy-fingerprint` action calls itself "not yet ready for use", so the pipeline is hand-rolled.

## Decision
- **Runtime matching.** `expo-updates` 57.0.25 uses `runtimeVersion: {policy: "fingerprint"}`, and each eas.json build profile has a channel of the same name.
- **`packages/app/scripts/eas-deploy.sh deploy`** (eas.yml, iOS only, eas-cli pinned to 24.12.1):
  - It computes the production fingerprint and looks for FINISHED production builds with that hash.
  - If one exists, it runs `eas update --channel production`. Otherwise it runs today's `npm run eas:submit`.
  - Any tooling error fails the job. It never falls through to a publish or a submit.
- **`predict`** runs the same logic in PR CI and prints the decision and both fingerprints.
- **`fingerprint.config.js` skips `ExpoConfigExtraSection`.**
  - app.config.ts derives `extra.apiUrl` from `NODE_ENV`. `expo config` defaults that to development, so the hash came out c29868dd… with the env unset (matching EAS build 116) but 69c53de… with `NODE_ENV=production`.
  - `extra` is read only by JS and ships in each update's manifest.
  - Never put native-affecting config in `extra`.
  - `sourceSkips` replaces the default skip list, so the default `PackageJsonAndroidAndIosScriptsIfNotContainRun` is listed too.
  - A `version` bump changes the fingerprint and takes the build path.
- **`APP_VARIANT=production` for every `eas update`.** A smoke test published to a branch that no channel pointed at, and its manifest said `"apiUrl":"http://localhost:3000"`. `eas update` evaluates the app config with expo's development default. An update like that would have pointed every user at localhost. The script now checks the URL before publishing, and reads it back from the published manifest afterwards.
- **Where the true runtime version lives.** It is the value the macOS builder resolves, logged in phase `CALCULATE_EXPO_UPDATES_RUNTIME_VERSION`. A build record's fingerprint is computed by eas-cli on whatever machine queued the build, which for this repo is the GitHub Linux runner.

## Implications
- **Bootstrap.** Builds before expo-updates never get OTA. The first merge carrying expo-updates builds and submits. Users receive updates only after that binary is released, and then on the next cold start (`ON_LOAD`, `fallbackToCacheTimeout: 0`).
- **Unreleased native changes block OTA hotfixes.** After a native merge, main's runtime has no released binary, so JS merges publish into the void until it ships.
  - Escape hatch: check out the released commit, run `APP_VARIANT=production eas update --channel production --platform ios --environment production`, and confirm the published `runtimeVersion` equals the released build's fingerprint.
  - Keep main releasable.
- **A FINISHED build counts even if its submit failed or App Review rejected it.** Updates then wait for the next binary. A merge during an in-flight native build starts another build.
- **Server first.** OTA reaches users minutes after merge, while the server deploys separately on DigitalOcean. Deploy any endpoint before merging JS that relies on it; the server stays additive-only.
- **Rollback.**
  - `eas update:rollback <groupId>` works only on the latest group for that branch and runtime.
  - `eas update:republish --group <previous>`.
  - `eas update:roll-back-to-embedded`.
  - `--rollout-percentage` exists on `eas update` and `republish`, not on rollback.
  - If an update fails to launch, expo-updates falls back to the previous update or the embedded bundle.
- **No update code signing.** A leaked `EXPO_TOKEN` could publish JS to every user. Code signing is a possible follow-up.
- **Spotting broken parity.** If eas.yml keeps choosing "build" on JS-only merges, compare `predict`'s hash with the builder log's runtime version.

## Related
- [[2026-10-06-reference-released-app-compatibility]] — still governs binaries that predate OTA, and the additive-only server rule
- [[2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build]] — why updates must never reach mismatched native code
- [[2026-10-10-bug-eas-default-node-rejected-npm-11-lockfile]] — the eas.json node pin the deploy builds keep
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] — SDK bumps change the fingerprint and always take the build path
