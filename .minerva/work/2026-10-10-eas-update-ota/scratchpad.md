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
