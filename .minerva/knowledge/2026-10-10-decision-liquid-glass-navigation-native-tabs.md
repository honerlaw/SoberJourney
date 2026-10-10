# iOS Liquid Glass comes from system navigation: native tabs, per-tab native Stacks, JS tabs on web

**Date**: 2026-10-10
**Type**: decision
**Theme**: app-navigation
**Summary**: NativeTabs plus per-tab native Stacks give system Liquid Glass; web keeps JS tabs
**Context**: .minerva/work/2026-10-10-expo-57-liquid-glass (see git history if the worktree has been cleaned up)

## Context
Apps built with the iOS 27 SDK can no longer opt out of Liquid Glass (`UIDesignRequiresCompatibility` is ignored). This was stated as an assumption, from Apple developer forum threads and 2026 coverage.

Before this change, the app's tab bar was a JS bar that never became glass. The tab headers were JS headers whose buttons faked glass through `GlassView` (a `forceGlass` prop), plus a `height: 120` header hack. A 3/3 approach panel picked system components over a custom `GlassView` tab bar, and over the SDK 58 beta for stable `native-tabs`.

## Finding
- **Tabs.** `(tabs)/_layout.tsx` uses `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 55–57 path; SDK 58 makes it `expo-router/native-tabs`).
  - Each trigger has an SF Symbol and a Material icon, with labels hidden.
  - A hidden `Label` sets the native title to `''`, so each trigger needs its own `accessibilityLabel` or screen readers announce unnamed tabs.
  - `expo-router` and `react-native-screens` are pinned exactly, because the unstable API can move between patches.
- **Headers.** Native tabs render no header. Each tab is a folder with a `_layout.tsx` Stack (`components/TabStackLayout`) whose `index` screen carries the title and the header buttons. URLs are unchanged.
  - On iOS 26, `headerLeft`/`headerRight` custom views get the system glass background.
  - `HeaderButton` is a plain transparent icon button with a required `label`. It is passed as `aria-label`, together with `accessible`: without `accessible`, iOS VoiceOver descends into the unlabeled icon instead of reading the label.
- **Web.** `(tabs)/_layout.web.tsx` keeps the JS tab bar, with headers coming from the per-tab Stacks. `.minerva/work/2026-10-10-expo-57-liquid-glass/verify-web-tabs-layout.cjs` asks expo-router's own resolver which layout each platform gets. This works signed out, and a mutation check proved it discriminates. Protected routes can't be rendered signed out.
- **Drawer.** The Sponsor conversation drawer (JS, `react-native-drawer-layout`) still wraps the native tabs. The header button dispatches `DrawerActions.openDrawer()` (`expo-router/react-navigation`), which bubbles from the tab's Stack to the drawer.
- **No glass composer.** The Sponsor composer is not glass. Its padded area sits behind the floating glass tab bar, and glass-on-glass is what Apple's guidance avoids.

## Implications
- New tabs need a folder with a Stack layout, a trigger with `sf`, `md` and `accessibilityLabel`, and a matching `Tabs.Screen` in `_layout.web.tsx`.
- A drawer rendered over a native `UITabBarController` was the main device risk at ship time. If it misbehaves, the fallback is the conversation list as a modal sheet route.
- On the SDK 58 upgrade, change the import to `expo-router/native-tabs` and re-check the trigger API.
- EAS uses its `auto` image (Xcode 26.6 for SDK 57). Building against the iOS 27 SDK (Xcode 27) is a separate step. With this change, the system chrome is already Liquid Glass.

## Related
- [[2026-10-10-constraint-native-tabs-insets-and-unmeasurable-tab-bar]] — layout consequence of native tabs
- [[2026-10-10-reference-expo-sdk-57-upgrade-notes]] — the SDK upgrade this rides on
- [[2026-10-06-constraint-app-provider-order]] — the provider tree the navigators sit in
