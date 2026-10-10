# On web, a TextArea must not take its height from RN-web onContentSizeChange

**Date**: 2026-10-10
**Type**: constraint
**Theme**: sponsor-chat
**Summary**: RN-web reports textarea scrollHeight as content size; sizing from it ratchets to the cap.
**Context**: .minerva/work/2026-10-10-chat-input-web-autogrow (see git history if the worktree has been cleaned up)

## Context
The Sponsor chat tab on web kept "rapidly expanding, scrolling and flickering" every time it opened, even after #54. `ChatInput` set its height from `onContentSizeChange` as `clamp(contentSize.height + 20, 44, 140)`. That is the pattern [[2026-10-06-reference-rn-web-textarea-keyboard]] recommends for all platforms.

## Finding
- On web, react-native-web 0.21 (under Tamagui 1.141 `TextArea`) reports `contentSize.height = textarea.scrollHeight`. A textarea's `scrollHeight` is never smaller than its own client height. So "height from reported content size + padding" feeds back on itself: 44 → 62 → 80 → … → 140, and the box can never shrink.
- RNW re-runs that report on every render, not just on input. `handleContentSizeChange` is a `useCallback` over the `onContentSizeChange` prop, and the host ref callback is a `useMemo` over it. An inline arrow therefore re-attaches the ref each render, which re-measures.
- The ratchet finishes before the first paint. The empty input is already 140px on the first painted frame (`scrollHeight == clientHeight == 138`). Every re-key of `ChatInput` (per conversation) replays it. Each step shrinks the inverted message list above it, which caused the visible flicker.
- The fix measures the DOM on web only. On web, `ChatInput` passes `onContentSizeChange={undefined}`; RNW gates its path on `multiline && onContentSizeChange`. It measures the `<textarea>` directly in a `useLayoutEffect` on `[text]` and in `onLayout`, using these steps:
  1. Save the inline height, the overflow and `scrollTop`.
  2. Set `overflow: hidden` and `height: 0px`.
  3. Read `scrollHeight + (offsetHeight − clientHeight)`.
  4. Restore everything in `finally`.
  5. Clamp the result.

  Native keeps `onContentSizeChange`, which reports the text's own height there.
- The web one-line height at the default Tamagui size is 52px (13+13 padding, 24px line, 1px borders), not the native-tuned 44. The 44 clamp floor is inert on web at that size.
- Chrome does not clamp `scrollTop` across the synchronous collapse and restore. The `scrollTop` restore is a guard for engines that do.

## Implications
- Any multiline auto-growing input on web must measure itself (collapse, then read). It must never reuse the reported content size, and it must never pass an inline `onContentSizeChange` on web.
- On web, `useLayoutEffect` keeps the temporary 0px collapse from ever being painted. Measuring in `useEffect` would flash.
- `overflow: hidden` during the read matters on always-visible-scrollbar platforms. Without it, a scrollbar narrows the wrap width and the text over-measures by a line.
- A fixed 44 must not be assumed for the web input's height.

## Related
- [[2026-10-06-reference-rn-web-textarea-keyboard]] — corrects its TextArea sizing advice for web (native advice still holds)
- [[2026-10-10-reference-real-browser-component-harness]] — how this was reproduced and verified
