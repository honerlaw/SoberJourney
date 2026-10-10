# Proposal: fix-web-export-expo-router-hoisting

**Date**: 2026-10-10
**Status**: Draft

**Seed:** "fix it". Fix the DigitalOcean production deploy failures diagnosed in-session.

## Goal

Make the DigitalOcean App Platform production build succeed again from a clean `npm ci` of `main`, so the deploy-on-push to `sober-journey-prod` goes green. That build is `npm run build:prod`, and its first step is `expo export -p web`. Also make PR CI fail if the production web export breaks again. No app runtime, server API or native-module version change.

## Why

- **Every deploy since SDK 57 failed.** All six prod deploys since the Expo SDK 57 upgrade failed in the build step: b88180d, 9e5cd06, 8be5a98, da8f69b, ffddc3f and 17808ee.
  - The error is `Error: Cannot find module 'expo-router/build/utils/url'`, thrown from `/workspace/node_modules/expo/node_modules/@expo/cli/build/src/export/exportStaticAsync.js:51` during `expo export --clear -p web`.
  - Prod still serves 3ed1a27, which is on SDK 54.
- **The cause is package placement.** Since b88180d the lockfile puts `@expo/cli` at `node_modules/expo/node_modules/@expo/cli` and `expo-router` at `packages/app/node_modules/expo-router`.
  - Node resolves upward from `@expo/cli` through the root `node_modules` only, so it never reaches `packages/app/node_modules`.
  - Nothing occupies root `node_modules/expo-router`, and `npm dedupe` does not hoist it.
- **Reproduced.** A clean `npm ci` of origin/main, then `NODE_ENV=production expo export --clear -p web` in `packages/app`, exits 1 with the same error.
- **CI missed it.** CI never runs the web export. It runs only `npm run build`, which is server tsc plus app `tsc --noEmit`, so the regression merged unnoticed.
- **Knowledge already recorded this pattern.** [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] notes that npm leaves expo-router un-hoisted. The fix then, for `@expo/metro-runtime` and `@expo/config-plugins`, was to declare them directly. The same entry recommends running `expo export -p web` before SDK bumps.

## Approach

1. **Pin `expo-router` at the root.**
   - Declare `"expo-router": "57.0.25"` in the root `package.json` `dependencies`. This is exactly the pin `packages/app` already has.
   - Regenerate the lockfile with `npm install --package-lock-only` (npm 11, the same major as CI's Node 24).
   - This forces expo-router into root `node_modules`, where `@expo/cli` resolves it.
   - Measured in a scratch worktree: 0 name@version changes in the lockfile and 55 path moves, as expo-router and its nested deps relocate. With the pin, `expo export -p web` exits 0.
   - The 55 is a path-move count only. Copy counts also change, by −2 `@expo/schema-utils`, −1 `expo-server` and +11 across 7 web-only `@radix-ui` packages. That is expected; see replan.md 2026-10-10.
2. **Add a CI step.** In `.github/workflows/ci.yml`, after Test and before the EAS build/submit step, run `npm run build:web --workspace=@onerlaw/soberjourney-server`.
   - This is the exact `build:pre` half of the `build:prod` command DigitalOcean runs.
   - A broken production web export then fails the PR before an EAS build is queued.
3. **Knowledge.** Add a bug entry recording:
   - the failure and its hoisting cause;
   - the root-pin fix, and that root and app pins must move together on SDK bumps or npm re-nests it;
   - the CI guard.

   Link it to the SDK 57 notes.

Alternatives considered:
- **B: set `NODE_PATH=<root>/node_modules` for `expo export`.** Tested; it still exits 1. Rejected.
- **C: delete and fully regenerate the lockfile.**
  - It can't be done locally without `NPM_TOKEN` for the private `@onerlaw/framework`.
  - It re-resolves every range: a non-lockfile-only `npm install` run churned about 5.7k lockfile lines.
  - It isn't shown to change placement.

  Rejected.
- **D: switch the DO app to the server Dockerfile, or change the DO build command.** That is an infrastructure change outside the repo, and it doesn't fix the underlying layout. Rejected.
- **E: pin in the server workspace.** The server doesn't use expo-router, so the root is the better location. Rejected.

## Success criteria

1. Root `package.json` declares `"expo-router": "57.0.25"`, the same pin as `packages/app`. After a clean `npm ci`:
   - `npm ls expo-router` shows one copy, at root `node_modules/expo-router`;
   - `packages/app/node_modules/expo-router` does not exist.
2. Running `git show origin/main:package-lock.json > <file>` and then `python3 -I .minerva/work/2026-10-10-fix-web-export-expo-router-hoisting/resolution_map.py <file> package-lock.json` reports exactly the following, and any other difference fails (replan.md 2026-10-10):
   - **(a)** an empty name@version symmetric difference. The set is keyed on name and version with install paths ignored, and it includes nested copies. Copy counts may change.
   - **(b)** exactly 17 differing consumer/dependency resolutions:
     - 3 where `expo-router` becomes resolvable (57.0.25) from `<root>`, `@expo/cli@57.0.28` and `@expo/router-server@57.0.12`;
     - 14 where the optional type-only `@types/react` peer of the moved `@radix-ui` packages moves from 19.2.18 to 19.3.0.
   - **(c)** exactly 2 name@version metadata differences: `@types/react@19.2.18` and `csstype@3.2.3` go from `devOptional` to `dev`.
3. Run root `npm run build:prod` (DO's build command) in the work-unit worktree after a clean `npm ci`, with the CI-style mock `packages/server/.env`. It exits 0, and `packages/server/static/index.html` exists.
4. On the same fresh install:
   - `npm run check:native-modules` (packages/app) exits 0;
   - root `npm run build` and `npm run test` pass;
   - `npx expo-modules-autolinking resolve --json` for ios and android gives the same sorted set of `(module name, version)` as on origin/main's fresh install. Install paths are ignored.
5. `.github/workflows/ci.yml` runs the `build:web` step before the EAS step, and the PR's CI is green, including that step.
   - On a clean `npm ci` of origin/main's lockfile, the same export command exits 1. This is the reproduction above, so the step would have caught this regression.
6. A knowledge bug entry links [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] and records:
   - the cause and the fix;
   - the pin-coupling caveat;
   - the CI guard;
   - the `@types/react` split (root 19.3.0 vs packages/app 19.2.18) as a possible source of type mismatches on future upgrades.

## Open Questions

- **Cron job build.** The DO `soberjourney-cron` job also uses `npm run build:prod`, so it builds a web bundle it never serves. Changing its build command is a DO app-spec change and the user's call, so it isn't part of this unit.
- **Native builds after merge.** No EAS build runs before merge. Criteria 2 and 4 are the proxy, since no version moves. Criterion 2 is now the version, resolution and metadata comparison from replan.md 2026-10-10, not a copy-count match. The first real native build is the CI EAS dev build on the PR, which is queued with `--no-wait`, plus eas.yml after merge.
- **Post-merge deploy.** Confirm that the DO deployment for the merge commit reaches ACTIVE. This is reported, not a pre-merge criterion.
