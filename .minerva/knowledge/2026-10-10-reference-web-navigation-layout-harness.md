# Web navigation layouts can be measured in a real browser with expo-router's own navigators

**Date**: 2026-10-10
**Type**: reference
**Theme**: app-infrastructure
**Summary**: Stub only expo-router's Stack/Tabs; bundle SDK 57 navigators; --ref proves fixes fail on main
**Context**: .minerva/work/2026-10-10-web-layout-polish (see git history if the worktree has been cleaned up)

## Context
The component harness ([[2026-10-10-reference-real-browser-component-harness]]) renders a single component. The web layout fixes needed the real header and tab bar: the per-tab `TabStackLayout` Stacks inside `(tabs)/_layout.web.tsx`. File-based routing and auth make the real app hard to drive headlessly.

## Finding
`.minerva/work/2026-10-10-web-layout-polish/verify-web-layout.mjs` extends the component harness:
- **Routing stub.** Only `expo-router` itself is stubbed, through an esbuild `onResolve` exact match so that `expo-router/assets/*` still resolve. `Stack`/`Tabs` map their `<X.Screen name options>` children onto `expo-router/native-stack` and `expo-router/js-tabs`. Screen components come from a registry. `Stack.Screen` rendered inside a screen calls `navigation.setOptions`. `router.push` records hrefs, so clicks can be asserted. The header and tab bar are the production ones.
- **Dependencies.** expo-router 57 (and its forked react-navigation under `build/react-navigation`) installs nested at `packages/app/node_modules`. Resolve that first (`nodePaths`), and alias `expo-modules-core` from `expo`'s nested copy. The harness fails loudly if `expo-router/js-tabs` is missing. A stale repo-root install (one was SDK 54 in the main checkout) would otherwise be tested silently.
- **Ref mode.** `--ref <git-ref>` loads the changed files from that ref through an esbuild `onLoad` plugin, without touching the working tree. `--expect-fail` asserts that every fix-guarding check fails there and that calibration numbers match the reported bug.
- **Simulated inset.** A `SafeAreaInsetsContext.Provider` override simulates the iOS Safari home-indicator inset. The tab bar and `useSafeAreaInsets()` read the same context.

## Implications
- Reuse this for web navigation chrome (headers, tab bar, drawer triggers) rather than mocking layout.
- App `tsc --noEmit` also needs SDK 57 deps and a built server. Run `npm run build` in `packages/server` with a placeholder `DATABASE_URL`, because the app imports types from `@onerlaw/soberjourney-server/dist/…`. Without it, about 58 errors appear in tRPC-typed files. npm 11 blocks install scripts by default (prisma, esbuild).
- A worktree's `node_modules` symlink is not matched by the `node_modules/` ignore pattern. Stage named paths and remove the links before shipping.

## Related
- [[2026-10-10-reference-real-browser-component-harness]] — the component-level harness this extends
- [[2026-10-10-constraint-web-js-tab-bar-fixed-height-and-top-aligned-icons]] — measured with it
- [[2026-10-10-reference-web-header-title-assumes-one-button-per-side]] — measured with it
