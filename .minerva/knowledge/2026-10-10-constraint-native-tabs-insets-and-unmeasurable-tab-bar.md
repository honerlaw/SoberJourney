# Native tabs hide the tab bar's height; screens sit under it on iOS and above it on Android

**Date**: 2026-10-10
**Type**: constraint
**Theme**: app-navigation
**Summary**: expo-router 57 native tabs: iOS content under the bar, Android above it; height unmeasurable
**Context**: .minerva/work/2026-10-10-expo-57-liquid-glass (see git history if the worktree has been cleaned up)

## Context
The tab layout moved from JS `Tabs` to `NativeTabs` (`expo-router/unstable-native-tabs`, expo-router 57.0.25) for the iOS 26 Liquid Glass tab bar. The Sponsor chat input used `useBottomTabBarHeight()` to lift itself above the keyboard. Native tabs have no equivalent, and the docs say the tab bar height cannot be measured.

## Finding
From the expo-router 57 source (`build/native-tabs/NativeTabsView.{ios,android}.js`):
- **iOS.** Each tab's content is wrapped in its own `SafeAreaProvider`, and the tab screen gets `overrideScrollViewContentInsetAdjustmentBehavior: true` unless `disableAutomaticContentInsets` is set. The automatic insets apply to scroll views only.
  - A plain-view screen root (the Sponsor page) extends under the floating tab bar.
  - Inside a tab, `useSafeAreaInsets().bottom` includes the tab bar plus the home indicator.
- **Android.** Content is wrapped in `SafeAreaView edges={{ bottom: true }}`, so the root ends above the tab bar. There is no inner provider, so `useSafeAreaInsets()` is the root's.
- **Web.** Uses the JS tab bar (`(tabs)/_layout.web.tsx`), so content sits above it and the bottom inset is 0.
- `NativeBottomTabsNavigator` is built on the forked `useNavigationBuilder`, so focus events and `useFocusEffect` behave as with JS tabs.

The Sponsor input therefore measures instead of asking (`SponsorPage/hooks/useInputBottomPadding`). It measures the root's distance to the bottom of the safe-area frame (`measureInWindow` against `useSafeAreaFrame()`), and only while the keyboard is hidden.
- Keyboard shown: padding = `keyboardHeight − offset + 14`.
- Keyboard hidden: padding = `max(0, insets.bottom − offset) + 13`.
- The offset is 0 on iOS and at least the inset on Android.
- The root's size never depends on the padding, so the measurement cannot feed back on itself.

## Implications
- Don't reintroduce `useBottomTabBarHeight` (it exists only for JS tabs via `expo-router/js-tabs`) or a hard-coded tab bar height.
- Lists inside a tab use `contentInsetAdjustmentBehavior="automatic"`. Manual `paddingBottom: insets.bottom` would double the gap on both platforms.
- Plain (non-scroll) iOS tab screens draw under the glass bar. Anything bottom-anchored must add the tab's bottom inset.
- Device-verified only through the PR's dev build. If a layout looks off, check Android with 3-button and gesture navigation separately.

## Related
- [[2026-10-10-constraint-native-textinput-autosize-not-contentsize]] — the same input, whose height must also never feed back from layout
- [[2026-10-10-decision-liquid-glass-navigation-native-tabs]] — the navigation change that introduced this
