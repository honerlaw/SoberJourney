# Replan log: fix-web-export-expo-router-hoisting

## 2026-10-10 — Criterion 2 checks versions and resolution, not lockfile copy counts

**Original plan**: Success criterion 2 required the lockfile's multiset of `(name, version)` entries to be identical before and after the root `expo-router` pin ("only paths move"). That rested on a pre-proposal scratch measurement of "0 name@version changes, 55 path moves".

**What changed**: The scratch measurement compared the **set** of name@version pairs; it never counted copies. Approach step 1 ran exactly as approved: `npm install --package-lock-only` on node 24.20.0 / npm 11.19.0.

- **Versions:** the set stayed identical, 1,943 name@version pairs on each side with an empty symmetric difference.
- **Copy counts:** npm re-dedupes and re-nests, so these changed:
  - −2 `@expo/schema-utils@57.0.2` and −1 `expo-server@57.0.3`, which are now deduplicated;
  - +11 copies across 7 web-only `@radix-ui` packages: `react-compose-refs@1.1.5` ×2, `react-context@1.2.2` ×2, `react-use-layout-effect@1.1.4` ×2, `primitive@1.1.7`, `react-id@1.1.4`, `react-use-controllable-state@1.2.6`, `react-use-effect-event@0.0.5`.
- **Why the radix copies grew:** they are expo-router's own transitive deps (react-tabs, roving-focus, collection, presence). They used to sit in `packages/app/node_modules`. Root `node_modules` already holds other radix versions, so they now nest under their root-level parents.

Criterion 2 is therefore unsatisfiable as worded. Matching the multiset literally would need manual pins or overrides for the radix packages. That adds permanent surface for no runtime benefit, so it was rejected.

`resolution_map.py`, committed in this unit's directory, measures what the criterion was protecting. It runs three comparisons of origin/main's lockfile against the branch's:

1. **name@version set:** empty difference.
2. **Per-consumer resolution:** for every lockfile entry and each declared dependency or peer, it simulates Node's upward `node_modules` lookup and compares `(consumer name@version, dep) → resolved version`. Over 5,439 and 5,440 pairs, exactly 17 differ:
   - **3 are the intended fix.** `expo-router` now resolves to 57.0.25 from `<root>`, `@expo/cli@57.0.28` and `@expo/router-server@57.0.12`. Before, it resolved to nothing.
   - **14 are an optional, type-only peer.** For the moved radix packages, `@types/react` now resolves to root 19.3.0 instead of packages/app's 19.2.18. Those packages are collection, compose-refs, context, direction, id, presence, primitive, roving-focus, slot, tabs, use-callback-ref, use-controllable-state, use-effect-event and use-layout-effect.
     - This is safe. The peer is optional and only affects TypeScript declarations. No declaration output ships, because the web export and Metro ignore `@types`. App `tsc --noEmit` passes in `npm run build`. The root-vs-app split between the two `@types/react` versions already existed in the tree.
3. **Install metadata per name@version** (integrity, `hasInstallScript`, dev/optional/devOptional/peer flags): exactly 2 differ, `@types/react@19.2.18` and `csstype@3.2.3`, which both go from `devOptional` to `dev`.
   - Both are type-only.
   - They are only reached through packages/app's devDependency now that the radix packages have stopped using them as peers.
   - `npm ci` installs dev dependencies in both CI and DO builds.

No runtime dependency resolves to a different version.

None of the moved or duplicated packages is native. The 7 radix packages are pure JS with no `hasInstallScript`. Criterion 4's autolinking `resolve` and `react-native-config` name+version sets for iOS and Android are identical to origin/main's.

`npm ci` installs exactly what this lockfile records. CI's green `npm ci` plus build on the PR confirms the same tree there.

**New plan**: The approach is unchanged. Success criterion 2 is restated with a pinned, reproducible pass condition: the three comparisons above, run as `git show origin/main:package-lock.json > <file>` then `python3 -I .minerva/work/2026-10-10-fix-web-export-expo-router-hoisting/resolution_map.py <file> package-lock.json`. Any output beyond the expected differences fails.

The proposal's Approach measurement line is annotated, and the Open Questions proxy note reflects the restated criterion. The knowledge entry must record the `@types/react` split (root 19.3.0 vs packages/app 19.2.18) as a possible source of type mismatches on future upgrades.
