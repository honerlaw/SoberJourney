# The app's native fingerprint covers package.json scripts and the installed node_modules

**Date**: 2026-11-03
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: Adding any app package.json script changes the iOS fingerprint (blocks OTA); compare fingerprints only on the same fresh install, never against a stale checkout
**Context**: .minerva/work/2026-11-03-security-audit-hardening (see git history if the worktree has been cleaned up)

## Context
The security-hardening unit had to ship its app privacy fix over the air. That works only while the production iOS fingerprint stays equal to a finished build's, so every app-side change was checked with `@expo/fingerprint` and `packages/app/scripts/eas-deploy.sh predict`.

## Constraint
- **App `package.json` scripts are fingerprinted.** Adding `"check:privacy-helpers": "node …"` to `packages/app/package.json` moved the iOS fingerprint from 239adbf6… to 72f9f8ad…. `fingerprint.config.js` keeps `PackageJsonAndroidAndIosScriptsIfNotContainRun` in `sourceSkips`, but that skips only the `android`/`ios` scripts, not the rest of the scripts block. Treat any app scripts edit as a native change.
  - Workaround used: CI runs the check directly (`node --experimental-strip-types packages/app/scripts/check-privacy-helpers.mjs`). New files under `packages/app/scripts/` and JS under `src/` did not change the hash.
- **Compare fingerprints only on the same, fresh install.** The hash includes every autolinked native module under `node_modules`. The primary checkout's `node_modules` were stale (pre-SDK-57) and gave 6120edc… for an unchanged main.
  - The correct comparison was to check out main's app files over the worktree's fresh `npm ci`, compute, then restore. Main and the branch then matched.
  - Server-only dependency updates (@clerk/express, body-parser, path-to-regexp, and the shared transitive patches they pulled) did not change the hash.
- `eas-deploy.sh predict` (eas-cli, logged in) is the authoritative check. It prints the production fingerprint and whether a finished production build has it ("Decision: update").

## Implications
- Before merging anything meant to ship over the air, run `predict` on a fresh install. Re-run it after a rebase.
- Put new app tooling in a script file that CI invokes directly, not in the app's `package.json` scripts, unless a store build is acceptable.
- A fingerprint mismatch seen only on a developer machine may just be stale `node_modules`. Check it on a fresh install before concluding that native code changed.

## Related
- [[2026-10-10-decision-eas-update-publish-on-merge-by-fingerprint]] — the publish-on-merge rule this protects
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] — SDK bumps are the expected way the fingerprint changes
- [[2026-11-03-reference-security-limits-and-residual-risks]] — the unit whose privacy fix depended on it
