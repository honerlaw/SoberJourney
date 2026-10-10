# On web, an absolutely positioned sibling paints over in-flow content regardless of order

**Date**: 2026-10-10
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: Web paints absolute fills over in-flow Text despite DOM order; give the content zIndex
**Context**: .minerva/work/2026-10-10-web-layout-polish (see git history if the worktree has been cleaned up)

## Context
`DurationProgressBar` draws its fill as a `position: absolute` View, followed by an in-flow label `Text`. On web, the fill covered the label wherever it reached it. A "1234 days" label at 62% was fully hidden. On iOS and Android the label showed correctly.

## Finding
CSS paints positioned descendants (`position: absolute` or `relative` with `z-index: auto`) after in-flow, non-positioned content in the same stacking context, whatever their DOM order. Tamagui's web `Text` is not positioned, so the earlier absolute sibling paints over it. React Native paints later siblings on top, so native looks right. The fix was `position="relative"` plus `zIndex={1}` on the label. react-native-web Views are `position: relative; z-index: 0`, so the label's `zIndex` stays inside the bar's own stacking context.

## Implications
- Any overlay-behind-content pattern (an absolute background, fill, highlight or badge under text) needs the content positioned and given a `zIndex` to render the same on web.
- Native screenshots don't catch this. Check on web, for example with `elementFromPoint` at the content's center (see [[2026-10-10-reference-web-navigation-layout-harness]]).

## Related
- [[2026-10-10-reference-real-browser-component-harness]] — the browser harness pattern used to prove it
- [[2026-10-10-reference-web-navigation-layout-harness]] — the assertion that guards `DurationProgressBar`
