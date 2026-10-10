# Scratchpad: expo-57-liquid-glass

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [panel — 3/3 accept, 3 with fixes] scope check: one unit, one PR to main, unphased; Part 1/Part 2 as separate commits (tier: panel — high blast radius: SDK-wide native upgrade whose merge triggers a production App Store release; parallel wave)
    - fix (proponent/skeptic/arbiter): name the rejected epic-base-branch alternative (epic PRs get no CI or EAS dev build) and the rejected phase-1-to-main option (extra production release)
    - fix: state the all-or-nothing cost; Part 1 and Part 2 as separately building commits so Part 2 reverts alone; replan contingency (may move to an epic base) if Part 1 hits a blocker
    - fix: EAS Xcode precondition (resolved: EAS `auto` image for SDK 57 is Xcode 26.6); the dev build + device checklist is the only native verification; the user holds the production submit by holding the merge; app-only scope (no server changes); soften the file-count estimate; "and then" read as ordering of the work
- [panel — 3/3 accept, 3 with fixes] approach: A — NativeTabs (expo-router/unstable-native-tabs) + per-tab native Stacks + system header glass, web keeps JS Tabs; rejected B (custom GlassView JS tab bar: imitation, keeps workarounds) and C (SDK 58 beta: not latest stable) (tier: panel — high blast radius on the navigation shell; parallel wave)
    - fix: drawer over native tabs is the main unknown — first device-checklist item, fallback = conversation list as a modal sheet (replan trigger)
    - fix: concrete openDrawer mechanism (`DrawerActions.openDrawer()` dispatched, via HeaderButton onPress) + "drawer opens from Sponsor" criterion
    - fix: name the expo-router replacements for @react-navigation imports (verified in the 57.0.25 tarball) so criterion 4 is achievable; typed-routes regeneration check
    - fix: justify custom header views over Stack.Toolbar items, with a fallback to native bar items
    - fix: push-tap cold/warm checklist items (canGoBack branch); keyboard-lift formula + fallback; contentInsetAdjustmentBehavior on lists, no scroll-edge/minimize promise for FlatList
    - fix: pin expo-router and react-native-screens exactly; record third-party compat checks (Tamagui 1.x); Android md icons + checklist item; glass composer optional/non-blocking; Xcode 27 enforcement stated as an assumption; cite the stable-SDK criterion for rejecting C; Skeptic's "separate PRs" superseded by the scope panel
- [reviewed — clean] whole-proposal (first wave): Skeptic returned revise (dynamic Sponsor title, drawer mechanism, keyboard-lift fallback, EAS Xcode image, Sentry/babel/react-compiler/web/expo-fetch items) — result held, then discarded as stale; its items were merged into the v2 draft alongside the panel fixes (tier: reviewer — blast-radius clauses adjudicated by the scope/approach panels; parallel wave)
- [reviewed — folded] whole-proposal (restart): restarted because the approach panel's fixes rewrote ## Success criteria; Skeptic accepted but flagged load-bearing gaps — iOS 16.4 minimum not stated as a user-facing consequence, useFocusEffect refetch not covered under NativeTabs — folded, plus keyboard-lift two-case rule, openDrawer pseudo-href, js-tabs path, test-suite note (tier: reviewer; parallel wave restart)
- [rechecked — residual folded] whole-proposal: fold-audit accepted; residuals folded — item 9 (react-native-drawer-layout is an expo-router dependency, gesture-handler an SDK peer) and item 6 (npm run test only exercises the server); item 1 keyboard Case 2 premise left as a work-time source read + device check (not load-bearing)

## Work notes
