# Proposal: fix-eas-node-version

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)

**Seed:** "expo build is failing". Fix the EAS build failures diagnosed in-session.

## Goal
Make EAS iOS builds (development and production profiles) get past INSTALL_DEPENDENCIES and build again from main, by running EAS on the same exact Node version (and so the same npm) as the repo's declared toolchain, and make PR CI fail if eas.json's Node pin drifts from `.nvmrc` or from CI's Node major. No app runtime, dependency or lockfile change.

## Why
- Every EAS build since c2e357f errored ~20–40s in (builds 111 prod/c2e357f, 112–113 dev, 114 prod/6a9ef43; build 110 on 17808ee finished). Build 111's log: EAS ran `npm ci --include=dev` on Node v22.23.1 / npm 10.9.8 (EBADENGINE vs root engines >=24.0.0) and failed `EUSAGE ... Missing: utf-8-validate@5.0.10 from lock file` x6.
- c2e357f regenerated package-lock.json on Node 24.20.0 / npm 11.19.0. Reproduced locally: on 6a9ef43's manifests+lockfile, `npx npm@10.9.8 ci --include=dev --dry-run --ignore-scripts` fails identically; npm 11 succeeds. On 17808ee both succeed.
- packages/app/eas.json pins no `node`, so EAS uses its image default (22). The repo-root `.nvmrc` (v24.11.1) is evidently not honored by EAS (build 111 ran 22.23.1). CI (ci.yml, eas.yml) uses node 24.x. CI only queues EAS with `--no-wait`, so GitHub stayed green — the same blind spot as [[2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build]].

## Approach

What shipped:
1. **`.nvmrc` → `v24.20.0`.** This is the lockfile producer; nodejs.org/dist/index.json lists v24.20.0 with npm 11.19.0. It is the single exact source of truth. Nothing else in the repo reads `.nvmrc`. The workflows use `24.x` and the server Dockerfile uses `node:24-alpine`.
2. **`packages/app/eas.json`.** The development, preview and production build profiles each set `"node": "24.20.0"`. eas-cli's schema semver-validates `node`, and `eas config` resolves it for all three.
3. **Guard.** `packages/app/scripts/check-eas-node-version.mjs` (`npm run check:eas-node`) runs in `ci.yml` right after `check:native-modules`. It is PR CI only; running it in eas.yml on main would be too late. It uses only Node built-ins and resolves paths from its own location. It fails if:
   - any build profile is not an object, or lacks a string `node`;
   - a profile's `node`, or an `ios`/`android` override of it, differs from `.nvmrc` (a leading `v` is stripped);
   - `.nvmrc`'s major differs from the running Node's major.

   `extends` is not resolved, so a profile must set its own `node`. From review, the guard also checks the per-platform overrides and reports non-object profiles.
4. **Knowledge.** [[2026-10-10-bug-eas-default-node-rejected-npm-11-lockfile]] records the cause, the fix, the guard and the residual `--no-wait` gap.

Alternatives rejected:
- **Regenerate the lockfile with npm 10.** The next npm 11 install re-breaks it, and EAS keeps violating `engines`.
- **An `eas-build-pre-install` hook that upgrades npm.** It's hacky, and Node is still 22.
- **Switching the EAS `image`.** It's implicit.
- **`engines.npm` / `engine-strict`.** These don't change which npm EAS runs.
- **A `lockfileVersion` check.** npm 10 and npm 11 both write v3, so it can't catch this.

## Success criteria
1. `.nvmrc` is `v24.20.0`; each of development/preview/production in packages/app/eas.json sets `"node": "24.20.0"`; `npx eas-cli config --platform ios --profile <p> --non-interactive` succeeds for each and shows node 24.20.0.
2. `npm run check:eas-node` (packages/app) exits 0 on the branch, and exits non-zero for: origin/main's eas.json (no node); a profile pinned to 22.x; a profile pinned to a 24.x patch different from `.nvmrc`.
3. ci.yml runs `check:eas-node` after `npm ci`, and the PR's CI is green.
4. The EAS iOS development build that the PR's CI queues (ci.yml `npm run eas:submit:dev`; located via `eas build:list --platform ios --json` as the development-profile build whose `gitCommitHash` equals that CI run's checked-out commit — the PR merge ref — or, if EAS records it differently, the PR head commit) shows Node v24.20.0 / npm 11.19.0 and no EBADENGINE in its install log, passes INSTALL_DEPENDENCIES, and reaches status `finished`. Auto-merge is enabled only after that (main is unprotected: `gh pr merge --auto` merges immediately, and merge triggers a production build + App Store submit via eas.yml). If the build errors, that is a criterion failure, not something to merge past; if it errors because EAS cannot provision Node 24.20.0, replan to the newest 24.x EAS does provision and move `.nvmrc` with it.
5. A knowledge bug entry records the cause, the fix, the guard, the residual gap, and the "EAS ignores root .nvmrc / defaults to its image Node" lesson, linking the two 2026-10-10 build-bug entries.

## Open Questions
- `.nvmrc` has no consumer other than local nvm users (no workflow uses `node-version-file`; the server Dockerfile uses `node:24-alpine`; DigitalOcean's Node buildpack reads `engines`), so the bump only nudges local dev to the lockfile producer.
- Post-merge: the eas.yml production build for the merge commit should finish; reported, not a pre-merge criterion.
