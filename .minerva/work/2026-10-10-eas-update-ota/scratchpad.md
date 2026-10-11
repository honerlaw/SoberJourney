# Scratchpad: eas-update-ota

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [reviewed — clean] scope check: one unit, one PR (tier: reviewer — multi-surface (app config, eas.json, script, two workflows), so solo denied; Skeptic confirmed single unit, its approach-level points were carried to the approach/whole-proposal folds; parallel wave)
- [panel — 3/3 accept, 3 with fixes] approach: A, hand-rolled fingerprint-gated eas-deploy.sh; rejected B continuous-deploy-fingerprint (README: not ready), C EAS Workflows (moves deploy off GH Actions + guards), D always-build, E manual-only (tier: panel — high blast radius: changes what every merge does to production users; parallel wave)
    - fix: count only FINISHED production builds; in-flight/errored fall through to build+submit
    - fix: fail closed on fingerprint/build:list errors (fail job, never `eas update`)
    - fix: assert production apiUrl and published runtimeVersion == looked-up hash; rollback runbook; bootstrap + launch behaviour + server-ordering docs; Linux parity as pre-merge gate
- [reviewed — clean] whole-proposal (first wave): discarded as stale — approach fixes rewrote ## Success criteria (restart condition)
- [reviewed — folded] whole-proposal (restart): `fingerprint:generate --build-profile` + `--environment` mutually exclusive (verified) → profile only; investigating it found the fingerprint hashes evaluated extra.apiUrl (NODE_ENV-dependent) → added fingerprint.config.js skipping ExpoConfigExtraSection (measured env-independent, prod==dev hash); documented hotfix-blocked-by-unreleased-native, server race, no code signing, repeated builds; smoke test reads apiUrl from the published update (tier: reviewer; parallel wave restart)
- [rechecked — residual folded] whole-proposal: items 8/9 + 3 new low concerns folded (rollback caveats, manual-hotfix runtime check, no native config in extra, fingerprint.config applied check in criterion 1, parity-alert note)
- [solo] mid-work divergence call: routine, no panel — the criterion-4 smoke test found the published manifest's extra.apiUrl = http://localhost:3000 because `eas update` evaluates app.config.ts with expo's NODE_ENV=development default (the draft's NODE_ENV=production pre-check was not the evaluation path). Fix stays inside the approved approach and criteria (step 3 "assert production apiUrl before publishing"; criterion 4 "read apiUrl from the published update"): script exports APP_VARIANT=production, pre-check uses the same evaluation path, plus a post-publish manifest read-back. Goal/scope/criteria unchanged, so not load-bearing (tier: solo — the plan's own criterion anticipated and caught this; no criterion or approach step changes meaning)

## Work notes 2026-10-10
- expo-updates: the proposal's `~29.0.15` came from the main checkout's stale SDK-54 node_modules; the fresh worktree's bundledNativeModules says ~57.0.25 (29.0.20 = sdk-54 dist-tag, nested expo-manifests 1.x). Installed ~57.0.25 → 57.0.25; lockfile +65 lines, 5 packages, no nesting; check:native-modules (50 entries) + check:eas-node pass.
- Fingerprint on this branch: 14ce2e10… for production AND development, with or without NODE_ENV=production / APP_VARIANT=production; without fingerprint.config.js it is 8e6e5047… (config applied).
- predict on branch → decision build (no finished production build has 14ce2e10…); no `eas` on PATH → exit non-zero; `build:list --fingerprint-hash c29868dd… --status finished` → build 116 (56035cd9).
- Smoke test 1 (branch ota-smoke-test, no channel): runtimeVersion 14ce2e10 ✔ but manifest extra.apiUrl = http://localhost:3000 ✘ → fixed with APP_VARIANT=production. Smoke test 2: runtimeVersion 14ce2e10 ✔, manifest apiUrl https://www.soberjourney.app ✔. Branch deleted (branch:list → []).
- No EAS Update channels existed before this; EAS Build / `eas update --channel` create them.
- Local: expo lint 0 errors (9 pre-existing warnings), root build OK, build:web OK.

## Decisions 2026-10-10 (completion + review)
- [reviewed — clean] completion verification: Verifier reproduced criteria 1, 3, 4 (incl. fingerprint with/without env and config, build:list → 56035cd9, no-eas exit, branch:list []), 2/5/6/7 correctly pending PR/promote; its `revise` named script defects (D1 dev-fingerprint swallowed in echo, D2 read-back aborts before rollback hint), not unmet criteria → handled as review FIXes (tier: reviewer floor)
- [solo] review triage: 6 FIX / 0 SUGGEST / 1 IGNORE — FIX: (a) parity gate compared Linux-vs-Linux (build record fingerprint is computed by eas-cli on the queueing runner) → criterion 6 now reads the macOS builder's CALCULATE_EXPO_UPDATES_RUNTIME_VERSION log value; (b) dev fingerprint assigned before echo; (c) read-back uses manifestPermalink, curl --retry, tolerant grep/sed, `|| true` so the rollback hint always prints; (d) `--message=`; (e) fingerprint.config keeps default PackageJsonAndroidAndIosScriptsIfNotContainRun skip; (f) comment that version bumps take the build path. IGNORE: D4 (update live before read-back) — inherent, mitigated by faithful pre-check + rollback hint. No item had two defensible dispositions; (a) clarifies how criterion 6 is measured without changing its intent, so no replan-vs-FIX panel (tier: default-solo row)

## Review fixes 2026-10-10
- Fingerprint with the fixed sourceSkips: 239adbf6… (was 14ce2e10…; the smoke-test runtime check used the earlier hash — same mechanism).
- Read-back parser tested: real manifest, spaced JSON, garbage, failed fetch (script continues to the rollback message).
