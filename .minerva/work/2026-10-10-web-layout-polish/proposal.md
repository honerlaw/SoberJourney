# Proposal: web-layout-polish

**Date**: 2026-10-10
**Status**: Draft

## Goal
Three client-only web-layout fixes on the tab screens, for mobile and desktop web:
1. The tab headers (Journeys / Sponsor / Journal) stop crowding the title against the left header button. On web the Profile-button-to-title gap grows, and the header buttons stay flat (transparent, no shadow) so they blend into the header. Non-tab headers keep their current spacing.
2. The web tab bar's icons sit vertically centered, with clear padding below them, instead of flush against the bottom of the screen.
3. A duration progress bar's label (e.g. "1234 days") always renders above its grey fill, on every platform.

There is no server or API change. Native iOS/Android navigation chrome is not changed: the system Liquid Glass header buttons and the NativeTabs bar stay as they are.

## Why
A user screenshot (narrow desktop web, 2026-10-10) shows three problems:
- the title "Journeys" sits about 5px from a shadowed white circular Profile button;
- the tab icons touch the bottom edge;
- under "Alcohol", the first bar's fill covers its label ("…ays").

Investigation used a real-browser probe of the current `main` web layouts (SDK 57 deps, headless Chrome, 466×780).
- **Floating circles are already gone on `main`.** The screenshot shows the pre-#58 header: `HeaderButton forceGlass` wrapped the icon in a 44px `GlassView` circle with a drop shadow (`git show b88180d^:packages/app/src/components/HeaderButton/HeaderButton.tsx`). On `main` the web header buttons are transparent 36px Tamagui buttons with no box-shadow. The title is still tight: the Profile button's box ends at x=62 and the title starts at x=73. That gap is the button's `marginHorizontal="$2"` (7px) plus the JS header's fixed `marginStart: 4` on the title.
- **Tab bar.** `(tabs)/_layout.web.tsx` sets `tabBarStyle.paddingTop: 14`. expo-router 57's JS `BottomTabBar` keeps its height at the default `49 + insets.bottom` (`getTabBarHeight`), so that padding eats the item area. The items get 35px, and the icons end 3.5px above the viewport bottom. Within each tab, the UIKit item is a `justifyContent: flex-start` column, so with labels hidden the icon also sits above the item's center.
- **Progress label.** `DurationProgressBar` draws the fill as `position: absolute` and the label as an in-flow `Text`. On web, CSS paints positioned elements above non-positioned in-flow content regardless of DOM order. The fill therefore covers the label wherever it reaches it; in the probe, "1234 days" at 62% is fully hidden. On native, React Native paints later siblings on top, so the label already wins there.

Native applicability:
1. iOS draws its own Liquid Glass capsules behind header bar buttons by design (#58 decision), and Android uses the native toolbar. The header spacing change is web-only. Android's title-to-button gap was not investigated (no device or emulator in this run); it is deliberately left as is, and the PR says so.
2. Native tabs are system bars and are not touched.
3. The label fix is cross-platform and harmless on native.

## Approach
- **Header (web, tab headers only).** In `TabStackLayout`, behind `Platform.OS === "web"`, wrap the Profile `headerLeft` button and the tab's `headerRight` output in a view with `paddingHorizontal: 6`. The right wrapper exists only when the tab passes a `headerRight`. Native receives exactly today's functions.
  - The title gap goes from 11 to 17px (7 button margin + 6 wrapper + 4 title margin). Left and right insets both go from 7 to 13px (symmetric).
  - `HeaderButton` is unchanged, so non-tab headers keep their spacing. Every tab header has one button per side and a short title, so the roughly 62px sides fit the JS header's one-button-per-side title width.
  - Buttons stay transparent; no shadow is reintroduced. (See replan.md: the first plan changed `HeaderButton` globally and regressed multi-button headers.)
- **Tab bar (web only).** In `_layout.web.tsx`, replace `paddingTop: 14` with an explicit `height: 64 + insets.bottom`, `paddingTop: 8` and `paddingBottom: 8 + insets.bottom`. The insets come from `useSafeAreaInsets()`, so iOS Safari's home-indicator inset is still respected when present. Add `tabBarIconStyle: { marginVertical: "auto" }` so the icon is centered in its flex-start tab item.
  - The item area is 48px; icons are centered, with about 19.5px clear above and below.
  - The bar grows from 49 to 64px, so the content area is 15px shorter. The library's compact height applies only when `Platform.OS === 'ios'`, so an explicit height loses nothing on web.
  - This does not conflict with `2026-10-10-constraint-native-tabs-insets-and-unmeasurable-tab-bar` ("no hard-coded tab bar height"). That constraint is about native tabs, whose height cannot be measured, and the Sponsor input that used to read it. The web JS bar lives in a web-only file, content sits above it in normal flow, and nothing in `src` reads its height. The edit stays inside `_layout.web.tsx`.
- **Progress label (all platforms).** In `DurationProgressBar`, give the label `Text` `position="relative"` and `zIndex={1}` so it stacks above the absolute fill on web. There is no visual change on native.
- **Verification.** A unit-local real-browser harness, `verify-web-layout.mjs`, follows the pattern in `2026-10-10-reference-real-browser-component-harness`.
  - It bundles the real `_layout.web.tsx`, `dashboard/_layout.tsx`, `TabStackLayout`, `HeaderButton`, `DurationProgressBar`, `WebLayout` and `JourneyInfoHeader` with expo-router's own forked navigators. Only expo-router's `Stack`/`Tabs`/`router`, which map onto `expo-router/native-stack` and `expo-router/js-tabs`, are stubbed. It then drives headless Chrome and asserts the success criteria.
  - `--ref origin/main --expect-fail` loads the changed files from `origin/main` and asserts that every fix-guarding check fails there.
  - **Dependencies.** The harness resolves packages from `packages/app/node_modules` first, then the repo root's, because expo-router 57 installs nested under the app. It needs a fresh `npm ci`, and it fails loudly if `expo-router/js-tabs` is missing. In a worktree, symlink an up-to-date install and never commit the link.
  - **Calibration and coverage.** The `--ref origin/main` run must reproduce the measured `main` numbers (title gap 11px, icon-to-bottom gap about 3.5px), which proves the stub lays out like production. Not covered: route files, the drawer wrapper, authenticated data.

### Candidates
- **A (first pick, superseded by the replan)**: a global `HeaderButton` web margin of `$3`. It regressed two-button non-tab headers.
- **B (adopted, via typed wrappers)**: spacing on tab headers only. The original objection was an untyped `headerTitleContainerStyle` cast. That is avoided by putting typed views inside the typed `headerLeft`/`headerRight` functions, and "only tab headers" is now the intended behavior.
- **C (header)**: a web-only custom `headerTitle` render function. Rejected: more code, and a function title on native would replace the system title view if the platform guard ever slipped.
- **D (tab bar)**: just delete `paddingTop: 14`. Rejected: the default bar leaves only 12px of breathing room, and the icon would still sit above center.
- **E (progress)**: render the label twice or clip-path the text in two tones. Rejected as over-engineered for a stacking-order bug.

### Scope
One unit, one PR: `TabStackLayout.tsx`, `(tabs)/_layout.web.tsx`, `DurationProgressBar.tsx`, plus the unit's harness and records. `HeaderButton.tsx` is not edited.

## Success criteria
1. **Web tab header.** Harness, Journeys tab at 466×780, 375×780 and 1280×800:
   - The gap from the Profile button's right edge to the "Journeys" title's left edge is ≥ 16px. 17px is expected; `main` measures 11.
   - The "New journey" button's right edge is ≥ 13px inside the header's right edge, and the Profile button's left edge is ≥ 13px inside the left edge.
   - The title's right edge stays left of the New journey button.
   - Clicking each wrapped button still fires its navigation (the stub router records `/profile` and `/journeys-new`).
   - Both buttons are transparent with `box-shadow: none`.
   - The gap and inset assertions fail against `origin/main`'s `TabStackLayout.tsx`.
2. **Non-tab header smoke check.** Harness, `JourneyInfoHeader` at 375px: the Delete button's right inset equals the `origin/main` value (7px). This is a baseline-parity smoke check against a baseline that is itself buggy (long titles overlap there), not a fails-against-main test. It covers JourneyInfoHeader only. The journal entry headers use the same unchanged `HeaderButton` without any wrapper.
3. **Web tab bar.** Harness, measured against the bar's content box (bounding rect minus computed `paddingTop`/`paddingBottom`):
   - Each tab icon's vertical center is within 1px of the content box's center.
   - The gap from each icon's bottom to the viewport bottom is ≥ 16px.
   - With a simulated 34px bottom safe-area inset, the gap is ≥ 50px and the icons are still centered.
   - These checks fail against `origin/main`'s `_layout.web.tsx`.
4. **Progress label.** Harness, bars at 0%, 62% (1234/2000) and 100%: `document.elementFromPoint` at the label's center returns the label text element. The 62% and 100% checks fail against `origin/main`'s `DurationProgressBar`.
5. **Native unchanged.**
   - The diff leaves `HeaderButton.tsx` and `(tabs)/_layout.tsx` (NativeTabs) untouched. The earlier Android `$2` / iOS-undefined check is moot.
   - Reading `TabStackLayout.tsx` shows both wrappers behind `Platform.OS === "web"`, with native passing the unwrapped functions. A tab without `headerRight` gets `undefined`, so no wrapper is rendered.
6. **Tooling.**
   - `packages/app` typecheck (`npx tsc --noEmit`) and lint (`npx eslint` on the changed app files) pass.
   - `npm run knip` in `packages/app` reports no finding that it does not also report on `main`.
   - The harness lives under `.minerva/work/`, outside the app's lint and knip roots.

## Open Questions
- None blocking. The screenshot's shadowed circles were the pre-#58 header. The PR will say so, so the user can confirm their deployed web build is current.
