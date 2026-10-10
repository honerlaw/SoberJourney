# Scratchpad: fix-web-export-expo-router-hoisting

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [solo] scope check: single unit, one PR (tier: solo predicate — one concern (build layout + its CI guard), additive, ~3 files, no interface, consistent with SDK 57 notes' declare-to-hoist precedent; parallel wave)
- [reviewed — clean] approach: root `expo-router` pin + CI `build:web` step; rejected B (NODE_PATH — tested, still fails), C (full lockfile regen — needs NPM_TOKEN, high churn), D (DO infra change) (tier: reviewer — interface-clause doubt on a new root pin passed to the Skeptic, which answered no: private root package, self-policing via CI step; noted-but-dismissed: optional pin-equality assertion in check-native-modules, no pre-merge EAS build (recorded as Open Question); parallel wave)
- [reviewed — clean] whole-proposal: Skeptic accepted; non-load-bearing clarifications applied editorially — criterion 3 names the mock .env, criterion 2 is a (name, version) multiset, criterion 4 compares name+version ignoring paths, criterion 5 says clean npm ci, CI step placed before EAS (tier: reviewer — not provably small: lockfile shared with EAS native builds; parallel wave, no restart: approach unchanged)
