# Scratchpad: fix-eas-node-version

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [solo] scope check: single unit, one PR (tier: solo predicate — additive config + one CI guard script, one concern (EAS Node parity), no public interface, no knowledge conflict; parallel wave)
- [reviewed — folded] approach: A (pin exact node in every eas.json profile + CI parity guard); Skeptic flagged .nvmrc v24.11.1 contradicting the 24.20.0 pin (overlooked surface) — folded: .nvmrc → v24.20.0, guard checks profile node == .nvmrc and .nvmrc major == runner major, no extends resolution. Rejected: npm-10 lockfile regen, pre-install npm upgrade hook, EAS image switch (tier: reviewer — affects every native/production build, not provably small; parallel wave)
- [rechecked — clean] approach: fold-audit found items 1–7 addressed; new concerns low (.nvmrc consumers, path resolution)
- [reviewed — folded] whole-proposal: Skeptic flagged criterion 4 build-location mechanics and the .nvmrc mismatch — folded both, plus engines.npm/lockfileVersion alternatives recorded (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: items 3 and 6 partial — folded a Node-provisioning fallback into criterion 4 and a PR-head fallback for locating the build; .nvmrc consumer note added to Open Questions

## Work notes 2026-10-10
- Implemented: .nvmrc v24.20.0; eas.json `node: "24.20.0"` in development/preview/production; packages/app/scripts/check-eas-node-version.mjs + `check:eas-node`; ci.yml step after check:native-modules (PR CI only).
- Guard verified: exit 0 on branch; exit 1 on origin/main eas.json (no node), all-22.23.1 pin, one profile at 24.11.1, and .nvmrc at v22.23.1 (major mismatch vs running 24.20.0).
- `npx eas-cli config --platform ios --profile <p> --non-interactive` shows node 24.20.0 for all three profiles (schema accepts it).
- Criteria 3–4 can only be checked on the PR: CI green, then the CI-queued EAS dev build must reach `finished` with Node 24.20.0 in its log BEFORE auto-merge (main is unprotected).
