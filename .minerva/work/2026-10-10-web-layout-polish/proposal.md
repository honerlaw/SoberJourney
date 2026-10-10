# Proposal: web-layout-polish

**Date**: 2026-10-10
**Status**: Draft

## Goal
Three web-layout fixes on the Journeys tab (mobile and desktop web), client-only:
1. The header title stops crowding the left header button: on web the gap between the Profile button and the title grows, and header buttons stay flat (transparent, no shadow) so they blend into the header.
2. The web tab bar's icons sit vertically centered with clear padding below them, not flush against the bottom edge of the screen.
3. A duration progress bar's label ("1234 days") always renders above its grey fill, on every platform.
No server/API change; native iOS/Android navigation chrome (system Liquid Glass header buttons, NativeTabs) is not changed.

## Why
User screenshot (narrow desktop web, 2026-10-10): the title "Journeys" sits ~5px from a shadowed white circular Profile button; the tab icons touch the bottom edge; under "Alcohol" the first bar's fill covers its label ("…ays").

Investigation (real-browser probe of the current `main` web layouts, SDK 57 deps, headless Chrome at 466×780):
- **Floating circles are already gone on `main`.** The screenshot shows the pre-#58 header: `HeaderButton forceGlass` wrapped the icon in a 44px `GlassView` circle with a drop shadow (`git show b88180d^:packages/app/src/components/HeaderButton/HeaderButton.tsx`). #58 removed that; on `main` the web header buttons are transparent 36px Tamagui buttons with no box-shadow. The title is still tight though: the Profile button box ends at x=62 and the title starts at x=73 (button `marginHorizontal="$2"` = 7px + the JS header's fixed `marginStart: 4` on the title).
- **Tab bar.** `(tabs)/_layout.web.tsx` sets `tabBarStyle.paddingTop: 14`. expo-router 57's JS `BottomTabBar` keeps its height at the default `49 + insets.bottom` (`getTabBarHeight`), so the padding eats into the item area: the bar is 35px of items, icons end 3.5px above the viewport bottom.
- **Progress label.** `DurationProgressBar` draws the fill as `position: absolute` and the label as an in-flow `Text`. On web, CSS paints positioned elements above non-positioned in-flow content regardless of DOM order, so the fill covers the label wherever it reaches it (probe: "1234 days" at 62% is fully hidden). On native, React Native paints later siblings on top, so the label already wins there.

Native applicability: (1) iOS draws its own Liquid Glass capsules behind header bar buttons by design (#58 decision) and Android uses the native toolbar — not touched. Android's title-to-button gap was not investigated (no device/emulator in this run); it is deliberately left as is and the PR says so. (2) native tabs are system bars — not touched. (3) the label fix is cross-platform and harmless on native.

## Approach
- **Header (web only)** — `HeaderButton`: web `marginHorizontal` `$2` → `$3` (7 → 13px); Android keeps `$2`; iOS unchanged (undefined). Title gap grows from 11px to 17px from the button box (≈29px from the icon glyph, near Material's 32px keyline), and the right button gets the same inset. Applies to every web header using `HeaderButton` (tab headers, journey info, journal entry pages) — consistent. Buttons stay transparent; no shadow is reintroduced.
- **Tab bar (web only)** — `_layout.web.tsx`: replace `paddingTop: 14` with an explicit `height: 64 + insets.bottom`, `paddingTop: 8`, `paddingBottom: 8 + insets.bottom` (insets from `useSafeAreaInsets()`, so iOS Safari's home-indicator inset is still respected when present). Item area = 48px; icons centered, ~19.5px clear above and below. The bar grows from 49 to 64px (content area 15px shorter). The library's compact height applies only when `Platform.OS === 'ios'`, so an explicit height loses nothing on web. This does not conflict with `2026-10-10-constraint-native-tabs-insets-and-unmeasurable-tab-bar` ("no hard-coded tab bar height"): that constraint is about native tabs, whose height is unmeasurable, and about the Sponsor input that used to read it. The web JS bar lives in a web-only file, content sits above it in normal flow, and nothing in `src` reads its height. The edit stays inside `_layout.web.tsx`.
- **Progress label (all platforms)** — `DurationProgressBar`: give the label `Text` `position="relative"` and `zIndex={1}` so it stacks above the absolute fill on web; no visual change on native.
- **Verification** — a unit-local real-browser harness `verify-web-layout.mjs` (pattern from `2026-10-10-reference-real-browser-component-harness`): bundles the real `_layout.web.tsx`, `dashboard/_layout.tsx`, `TabStackLayout`, `HeaderButton`, `DurationProgressBar` and `WebLayout` with expo-router's own forked navigators (only `expo-router`'s `Stack`/`Tabs`/`useRouter` are stubbed to map onto `expo-router/native-stack` and `expo-router/js-tabs`), drives headless Chrome, and asserts the success criteria. `--component`-style ref mode runs it against `origin/main` files to prove each assertion fails before the fix.
  - **Dependencies.** The harness resolves packages from `packages/app/node_modules` first, then the repo root's (`nodePaths`), because expo-router 57 is installed nested under `packages/app`. It needs a fresh `npm ci`: the main checkout's root `node_modules` is currently stale SDK 54. In the worktree, symlink an up-to-date install and never commit the link. The harness fails loudly if `expo-router/js-tabs` cannot be resolved, rather than silently testing older code.
  - **Calibration and coverage.** The stub replaces only the route wiring. Before the fixed code is tested, the harness must reproduce the measured `main` numbers against the `origin/main` files: Profile button right edge to title is 11px, and icon bottom to viewport bottom is about 3.5px. That proves the stub lays out like production. It does not cover expo-router's file-based routing, the drawer wrapper or authenticated data.
  - **Other headers.** A header with a left and a right `HeaderButton` (the Journeys header) is checked in the harness. One non-tab header (`JourneyInfoHeader`) is inspected by screenshot at 375px width for title truncation.

### Candidates
- **A (recommended)** — the three targeted edits above.
- **B (header)** — web-only `headerTitleContainerStyle: { marginStart: 16 }` in `TabStackLayout`. Rejected: works at runtime (the web native-stack spreads unknown options into the JS `Header`) but is not in `NativeStackNavigationOptions` types, so it needs a cast; and only tab headers would get it.
- **C (header)** — web-only custom `headerTitle` render function with its own margin. Rejected: more code, and a function title on native would replace the system title view if the platform guard ever slipped.
- **D (tab bar)** — just delete `paddingTop: 14` (icons centered in the default 49px bar, 12px each side). Rejected as weaker: smaller bottom breathing room than the user asked for; A gives ~19.5px.
- **E (progress)** — render the label twice / clip-path two-tone text. Rejected: over-engineered for a stacking-order bug.

### Scope
One unit, one PR: `HeaderButton.tsx`, `(tabs)/_layout.web.tsx`, `DurationProgressBar.tsx`, plus the unit's harness and records.

## Success criteria
1. Web header (harness, 466×780, Journeys tab): the distance from the Profile button's right edge to the "Journeys" title's left edge is ≥ 16px (13px button margin + the header's 4px title margin = 17 expected; main measures 11). The "New journey" button's right edge is ≥ 13px inside the header's right edge. Both header buttons have a transparent background and `box-shadow: none`. The two spacing assertions fail against `origin/main`'s `HeaderButton`.
2. Web tab bar (harness): measured against the bar's content box (the bar's bounding rect minus its computed `paddingTop`/`paddingBottom`), each tab icon's vertical center is within 1px of that box's center. The gap from each icon's bottom to the viewport bottom is ≥ 16px. With a simulated 34px bottom safe-area inset (harness overrides the insets context), the gap is ≥ 16 + 34px and the icons are still centered in the content box. The gap assertion fails against `origin/main`'s `_layout.web.tsx`.
3. Progress label (harness): for bars at 0%, 62% (1234/2000) and 100% (fill covers the whole label), `document.elementFromPoint` at the label's center returns the label text element (or a descendant). Fails against `origin/main`'s `DurationProgressBar`.
4. On native, `HeaderButton` keeps `marginHorizontal` `$2` on Android and none on iOS, and `(tabs)/_layout.tsx` (NativeTabs) is unchanged — checked from the diff.
5. `packages/app` typecheck (`npx tsc --noEmit`), lint (`npx eslint` on the changed app files) pass, and `npm run knip` in `packages/app` reports no finding that it does not also report on `main`. The harness lives under `.minerva/work/`, outside the app's lint/knip roots.

## Open Questions
- None blocking. The screenshot's shadowed circles were the pre-#58 header; the PR will say so, so the user can confirm their deployed web build is current.
