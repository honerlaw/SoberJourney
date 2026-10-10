# EAS built on its default Node 22 / npm 10, which rejected the npm 11 lockfile, so every EAS build failed at install

**Date**: 2026-10-10
**Type**: bug
**Theme**: app-infrastructure
**Summary**: EAS ignored .nvmrc and ran npm 10, whose npm ci rejected the npm 11 lockfile; eas.json now pins node to .nvmrc, CI-guarded
**Context**: .minerva/work/2026-10-10-fix-eas-node-version (see git history if the worktree has been cleaned up)

## Context
c2e357f (PR #64) regenerated `package-lock.json` on Node 24.20.0 / npm 11.19.0 to hoist expo-router. From that commit on, every EAS iOS build errored about 30 s in, during INSTALL_DEPENDENCIES. This hit production builds 111 and 114 and development builds 112 and 113. GitHub CI stayed green the whole time.

## Finding
- **What happened.** `packages/app/eas.json` pinned no `node`, so EAS used its image default: Node v22.23.1 / npm 10.9.8. That violated root `engines` (`>=24.0.0`) and printed EBADENGINE. npm 10's `npm ci` sync check then rejected the npm 11 lockfile with `Missing: utf-8-validate@5.0.10 from lock file` (×6). `utf-8-validate` is an optional peer of the nested `ws@7` copies.
- **Reproduction.** Copy the root and workspace `package.json` files plus the lockfile into an empty directory, then run `npx npm@10.9.8 ci --include=dev --dry-run --ignore-scripts`. It fails on 6a9ef43 and passes on 17808ee. npm 11 passes both. Why npm 10 accepted the older lockfile was not investigated.
- **EAS ignores the repo-root `.nvmrc`.** It said v24.11.1, yet the build ran Node 22.
- **Fix.**
  - `.nvmrc` is now `v24.20.0`, the lockfile producer, which bundles npm 11.19.0.
  - Every eas.json build profile sets `"node": "24.20.0"`.
  - `packages/app/scripts/check-eas-node-version.mjs` (`npm run check:eas-node`) runs in PR CI after `npm ci`. It fails when:
    - a build profile, or an `ios`/`android` override in it, does not pin the `.nvmrc` version;
    - `.nvmrc`'s major differs from the Node running CI (`24.x`).

## Implications
- **Bumping Node.** Move `.nvmrc`, every eas.json profile's `node` and the workflows' `node-version` together. The guard fails until they match. After regenerating the lockfile, check that EAS's Node bundles the same npm major.
- **Residual gap.** The guard proves the config matches, not that EAS's install succeeds. CI still queues EAS with `--no-wait`, so an EAS failure never turns a GitHub check red. This is the third 2026-10-10 build break that only a real EAS build or deploy surfaced. For any lockfile or toolchain change, watch the PR's EAS build reach `finished` before merging.

## Related
- [[2026-10-10-bug-un-hoisted-expo-router-broke-production-web-export]]: the lockfile regeneration that exposed this
- [[2026-10-10-bug-transitive-native-modules-broke-sdk-57-ios-build]]: same `--no-wait` blind spot
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]]: the SDK upgrade checklist this adds a toolchain step to
