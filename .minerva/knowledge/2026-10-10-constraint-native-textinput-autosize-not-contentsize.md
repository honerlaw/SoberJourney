# Native multiline inputs auto-size through layout, never from onContentSizeChange

**Date**: 2026-10-10
**Type**: constraint
**Theme**: sponsor-chat
**Summary**: On Fabric iOS, onContentSizeChange re-fires every layout pass; use minHeight/maxHeight auto-size instead.
**Context**: .minerva/work/2026-10-10-chat-input-native-autosize (see git history if the worktree has been cleaned up)

## Context
After #56 fixed web, the iOS app's Sponsor chat input still resized up and down continuously, and the whole screen flickered. On native, `ChatInput` still set `height = clamp(contentSize.height + 20, 44, 140)` from `onContentSizeChange` and toggled `scrollEnabled` at the 140 cap. The earlier entries [[2026-10-06-reference-rn-web-textarea-keyboard]] and [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] said to drive the height from `onContentSizeChange`, and that this was fine on native.

## Finding
These facts come from the react-native 0.81.5 source, with the new architecture enabled:
- On iOS, `RCTTextInputComponentView` `updateLayoutMetrics:` sets the backing text view's frame and insets. It then re-emits `onContentSizeChange` whenever `contentSize` changed. That makes every height JS sets a new report: a feedback path.
- `RCTUITextView` `contentSize` is `max(super.contentSize, placeholderSize)` and already includes the padding (`textContainerInset`), so the +20 double-counted it.

The perpetual oscillation (grow by +20 per pass; at the cap scrolling turns on and the reported size drops; then it repeats) is **inferred** from that code path. It was not reproduced on a simulator, because none was installed and the disk was low.

The fix removes the JS loop. On native, the TextArea gets only `minHeight` 44, `maxHeight` 140 and `textAlignVertical: "top"`: no `height`, no `onContentSizeChange`, no `scrollEnabled`. Fabric's `BaseTextInputShadowNode::measureContent` measures the multiline text (the placeholder when empty) within the layout constraints. The measurement depends on the text and the width, not on the box height, so it converges. Tamagui 1.141.5's native `textAreaSizeVariant` yields `height: "auto"` when `rows`/`numberOfLines` are undefined; its `getButtonSized` height is overridden last. A multiline input scrolls internally past `maxHeight` by default. Web keeps its own measured height (#56).

## Implications
- Never set a TextInput's height from `onContentSizeChange` on either platform. Web ratchets, and native re-reports after every layout. This corrects the 2026-10-06 advice and the native sentence of the 2026-10-10 constraint.
- On native, an auto-growing multiline input means `minHeight`/`maxHeight`, with `rows`/`numberOfLines` explicitly undefined so that Tamagui leaves the height at `"auto"`.
- `.minerva/work/2026-10-10-chat-input-native-autosize/verify-chat-input-native-props.mjs` guards ChatInput's prop choice only, not Tamagui resolution or native layout. Re-check on device after a Tamagui upgrade.
- If flicker persists on device, the next suspect is the keyboard padding path: `useKeyboardHeight` `bottomPadding`, and `animation="quick"` on the input container.

## Related
- [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] — corrects its native sentence ("Native keeps onContentSizeChange")
- [[2026-10-06-reference-rn-web-textarea-keyboard]] — corrects its "drive height from onContentSizeChange" advice
- [[2026-10-10-reference-real-browser-component-harness]] — the web harness re-run to confirm web did not regress
