# Scratchpad: fix-ios-build-react-native-svg

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [reviewed — clean] scope check: one unit, one unphased PR (svg fix + drift guard + knowledge entry) (tier: reviewer — new CI check is a new cross-cutting contract, denies solo; no panel clause: additive, no existing-interface change; parallel wave). Noted, not load-bearing: bound the EAS wait, sanity-check the lockfile diff — folded as operational detail.
- [reviewed — clean] approach: A — lockfile vs expo bundledNativeModules check script + CI step, exact-version allowlist for async-storage; rejected B (expo-doctor/install --check only see direct deps — proven by PR #58), C (declare transitive modules, no guard — dominated), D (CI waits on EAS — 20+ min/PR, billing contract change; follow-up idea) (tier: reviewer — new tooling surface; parallel wave). Wording notes folded: guard limited to expo-listed packages; dev-vs-production assumption; parser edge cases; skip link/versionless entries.
- [reviewed — folded] whole-proposal: Skeptic flagged load-bearing gaps — scan every lockfile key incl. packages/app/node_modules and nested (not just hoisted); step 6 "wait on the PR's --no-wait dev build before auto-merge" not codifiable → native compile proven BEFORE the PR with a non-submitting EAS **production** build (--wait, 60-min bound, replan on failure); range forms are only exact/~/^ in SDK 57; allowlist keyed name@version across paths + stale-allowlist mutation; knip; install via package.json edit + npm install (not expo install on the stale checkout); new knowledge entry (tier: reviewer; parallel wave — approach/scope unchanged so no restart)
- [rechecked — residual folded] whole-proposal: fold-audit accepted (11/12 addressed); residuals folded — script header names expo's JS-only entries as a limit; pre-PR build must cover the final native-affecting state, re-run if package.json / lockfile / app.json change after it

## Work notes
