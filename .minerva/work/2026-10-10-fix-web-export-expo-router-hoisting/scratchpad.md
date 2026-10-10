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
- [panel — 3/3 accept, 3 with fixes] divergence: criterion 2 (lockfile multiset identical) unsatisfiable under the approved approach — copy counts change (−2 @expo/schema-utils, −1 expo-server, +11 across 7 web-only @radix-ui); load-bearing → replan, approach unchanged (tier: panel floor — mid-work divergence)
    - fix (arbiter/skeptic/proponent): keep the name@version set-equality clause; add per-consumer resolution comparison clause
    - fix: replan "What changed" states the scratch measurement was set-based and missed copy counts
    - fix: annotate proposal Approach measurement line with the copy-count deltas
    - fix: list the 17 resolution differences in replan.md and why the @types/react peer shift is safe
    - fix: record resolution_map.py as the verification method (committed in the unit dir), npm 11.19.0, npm ci consumes the lockfile as written
    - fix: state no moved/duplicated package is native (identical autolinking sets)
    - fix: knowledge entry notes the @types/react split (root 19.3.0 vs packages/app 19.2.18)
- [panel — 3/3 accept, 3 with fixes] new-plan acceptance: replan 2026-10-10 — approach unchanged, criterion 2 restated as name@version set equality + per-consumer resolution diff (17 expected) (tier: panel floor — new-plan acceptance)
    - fix: criterion 2 pins the expected script output; any other difference fails
    - fix: set-equality and install-metadata (integrity/hasInstallScript/flags) comparisons folded into resolution_map.py; metadata run found exactly 2 type-only flag changes (@types/react@19.2.18, csstype@3.2.3 devOptional→dev), pinned as criterion 2(c)
    - fix: exact input commands (`git show origin/main:package-lock.json`) named in the criterion
    - fix: native claim cites the 7 radix packages as pure JS (no hasInstallScript) plus criterion 4's autolinking sets
    - fix: Approach annotation says 55 = path moves, copy-count deltas separate; Open Questions proxy note updated
    - fix: @types/react safety: optional type-only peer, no @types output ships, split pre-existed; knowledge note made an explicit deliverable (criterion 6)
    - fix: npm sentence softened to "npm ci installs exactly what this lockfile records", backed by CI
    - fix: resolution_map.py committed with the unit
- [reviewed — clean] completion verification: Verifier reproduced C1–C4 and C6 and the verifiable half of C5; PR-CI-green half of C5 correctly deferred to ship's CI watch (auto-merge only on green) (tier: reviewer floor — no interface change beyond what the proposal approved)
- [solo] review triage: 4 FIX / 0 SUGGEST / 1 IGNORE — FIX: (1) pin drift not caught by the export step → MUST_BE_HOISTED assertion in check-native-module-versions.mjs, verified to fail on origin/main's lockfile and a simulated 57.0.26 app-pin drift; (2) the "nothing native moved" claim was wrong (expo-router, @expo/ui and masked-view moved path) → reworded; (3) radix copies +10, not +11 → corrected; (4) knowledge misattributed the autolinking check and said "empty" → corrected. IGNORE: (5) resolution_map.py exits 0 and compares versions only — one-off verification tool, expected output pinned in criterion 2, reviewer checked install locations directly. Minerva audit: no findings. (tier: default-solo row — no item had two defensible dispositions; FIX (1) not a load-bearing divergence: the approach and goal are unchanged and it hardens the existing guard)

## Work notes 2026-10-10
- Root `package.json` gains `"dependencies": {"expo-router": "57.0.25"}`; lockfile regenerated with `npm install --package-lock-only` (node 24.20.0 / npm 11.19.0). `npm ci` leaves the regenerated lockfile untouched.
- CI: new step `🌐 Export production web bundle (mirrors the DigitalOcean build)` → `npm run build:web --workspace=@onerlaw/soberjourney-server`, after Test, before EAS.
- Verified on a clean `npm ci` in the worktree (mock `packages/server/.env` as in CI): one expo-router at root; `npm run build:prod` exit 0 + `packages/server/static/index.html`; `check:native-modules` exit 0; `npm run build` exit 0; server tests 305/305; autolinking `resolve` + `react-native-config` name/version sets identical to the origin/main baseline (ios 35 expo/13 RN, android 31/13).
- Lockfile: name@version SET identical; copy-count multiset differs (radix dupes +10 — the divergence panel was told +11, corrected in review, schema-utils −2, expo-server −1). Per-consumer resolution map (5,439 pairs): only expo-router newly resolvable (3) + radix packages' optional type-only `@types/react` peer now root 19.3.0 vs app 19.2.18 (14). → criterion 2 unsatisfiable as worded; divergence panel convened.
- Dead end: `NODE_PATH=<root>/node_modules` does not help `expo export` (still exit 1).
- Gotcha: local main checkout's node_modules is stale SDK 54 — it hides this failure; always verify on a fresh `npm ci`.
