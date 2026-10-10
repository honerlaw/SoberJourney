# The web JS header sizes its title for one button per side

**Date**: 2026-10-10
**Type**: reference
**Theme**: app-navigation
**Summary**: Web header titles overlap multi-button right slots; tab headers pad buttons in TabStackLayout
**Context**: .minerva/work/2026-10-10-web-layout-polish (see git history if the worktree has been cleaned up)

## Context
On web, each Stack's header is expo-router 57's JS `Header` (forked react-navigation `elements`). Native uses the system header, which is Liquid Glass on iOS 26. A user reported the Journeys title sitting too close to the Profile button on web.

## Finding
- **Title width.** With a left-aligned title, `Header` caps it at `maxWidth = width − (left ? 52 : 16) − (right ? 52 : 16) − insets`, which assumes one 52px button per side. It places the title 4px after the left container. `HeaderButton`'s own web margin is 7px, so on `main` the title sat 11px from the Profile button.
- **Multi-button overlap.** On a multi-button right slot, such as `JourneyInfoHeader` (Edit + separator + Delete, about 110px), a long journey title runs into the buttons on web. This exists on `main` and is not fixed. Fixing it needs a header-wide decision: either a custom `headerTitle` on web, or overriding the title container's width. That is beyond a small absorbed fix, and it is cosmetic and web-only.
- **Tab header spacing.** The tab headers (Journeys / Sponsor / Journal) get their extra web spacing in `TabStackLayout`, not in `HeaderButton`. On web only, the Profile `headerLeft` button and the tab's `headerRight` are wrapped in a `paddingHorizontal: 6` view. That makes the title gap 17px and both edge insets 13px. Native gets the unwrapped functions.
- **Rejected approach.** Widening `HeaderButton`'s margin globally was tried first. It grew a two-button group by 24px and made the JourneyInfoHeader overlap visibly worse (replan, 2026-10-10).

## Implications
- Don't widen `HeaderButton`'s margin to fix spacing. It changes every web header, including multi-button ones.
- A header with more than one button per side on web needs a short title, or the title-width fix described above.
- `headerTitleContainerStyle` would work at runtime on web, because the web native-stack spreads unknown options into `Header`. It is not in `NativeStackNavigationOptions`, so it needs a cast.

## Related
- [[2026-10-10-decision-liquid-glass-navigation-native-tabs]] — per-tab Stacks and `HeaderButton`, the structure this spacing lives in
- [[2026-10-10-reference-web-navigation-layout-harness]] — measures the gap and insets, and smoke-checks JourneyInfoHeader
