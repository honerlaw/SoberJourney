# The web JS tab bar has a fixed height and top-aligns icons when labels are hidden

**Date**: 2026-10-10
**Type**: constraint
**Theme**: app-navigation
**Summary**: Web tab bar padding eats its fixed 49px height; center label-less icons with auto margins
**Context**: .minerva/work/2026-10-10-web-layout-polish (see git history if the worktree has been cleaned up)

## Context
Web keeps the JS bottom tab bar (`(tabs)/_layout.web.tsx`, from expo-router 57's forked `bottom-tabs`). Native uses NativeTabs. On web the tab icons sat flush against the bottom of the screen. The layout had set `tabBarStyle.paddingTop: 14` to give the icons room.

## Finding
- **Height is fixed.** `getTabBarHeight` returns `49 + insets.bottom` unless `tabBarStyle.height` is a number. Padding in `tabBarStyle` is applied inside that height and does not add to it. `paddingTop: 14` left 35px of item area, so the icons ended 3.5px above the viewport bottom.
- **Overrides.** `tabBarStyle` is spread after the library's own `paddingBottom: insets.bottom`. An explicit `paddingBottom` therefore replaces the inset, so add `insets.bottom` back yourself (`useSafeAreaInsets()`).
- **Icons are top-aligned.** The UIKit tab item, the inner `role="tab"` button, is a `justifyContent: flex-start` column with 5px padding. With `tabBarShowLabel: false` the icon sits at the top of the item. `tabBarItemStyle` lands on the outer wrapper and cannot change that. `tabBarIconStyle: { marginVertical: "auto" }` centers the icon.
- **Wide screens.** At widths of 768px and above the bar switches to its beside-icon (row) layout. The same settings center the icon there too.
- **Shipped settings.** The bar now uses `height: 64 + insets.bottom`, `paddingTop: 8`, `paddingBottom: 8 + insets.bottom` and auto icon margins. Icons are centered with 19.5px of clear space above and below.

## Implications
- Change tab bar spacing by setting height and padding together. Padding alone shrinks the items.
- This is web-only. [[2026-10-10-constraint-native-tabs-insets-and-unmeasurable-tab-bar]]'s "no hard-coded tab bar height" is about native tabs, whose height cannot be measured. On web, content sits above the JS bar in normal flow and nothing reads the bar's height.
- If a tab ever shows labels, re-check the auto margins, which then center the icon and label as a group.

## Related
- [[2026-10-10-constraint-native-tabs-insets-and-unmeasurable-tab-bar]] — the native counterpart; its height rule does not apply to the web JS bar
- [[2026-10-10-decision-liquid-glass-navigation-native-tabs]] — why web keeps the JS tab bar
- [[2026-10-10-reference-web-navigation-layout-harness]] — the harness that measures this
