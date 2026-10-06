# RN-web keypress events, Tamagui TextArea sizing, Android edge-to-edge keyboard

**Date**: 2026-10-06
**Type**: reference
**Theme**: sponsor-chat
**Summary**: RN-web onKeyPress gets DOM events; TextArea defaults to fixed 4 lines; Android doesn't resize for keyboard.
**Context**: .minerva/work/2026-10-06-sponsor-chat-client (see git history if the worktree has been cleaned up)

## Context
Building the multiline sponsor chat input (`components/pages/SponsorPage/ChatInput`) surfaced several platform facts. The library sources confirm each of them, and none of them shows up in the type definitions.

## Finding
- **react-native-web** passes `TextInput`'s `onKeyPress` handler the DOM keyboard event, so `shiftKey`, `preventDefault()`, `nativeEvent.isComposing` and `nativeEvent.keyCode` are all available (`react-native-web/dist/exports/TextInput`, `handleKeyDown`). For a `multiline` input, `onSubmitEditing` does not fire on Enter unless `blurOnSubmit` is set. To get Enter-to-send with Shift+Enter for a newline, handle it in `onKeyPress`. Guard IME input with `isComposing || keyCode === 229`, because Safari reports IME commit keydowns with `isComposing === false`.
- **Tamagui `TextArea`** defaults to `rows` / `numberOfLines` = 4. Its size variant (`textAreaSizeVariant`) sets a fixed `height = lines × lineHeight`, so `minHeight` / `maxHeight` have no effect and the field never grows. On native, `numberOfLines` also caps how many lines are visible. For an auto-growing input, pass `rows={undefined} numberOfLines={undefined}` and drive `height` from `onContentSizeChange`.
- **Android keyboard**: `packages/app/app.json` sets `edgeToEdgeEnabled: true` and no `softwareKeyboardLayoutMode`. Under edge-to-edge, Android does not resize the window for the keyboard, so screens lift their inputs manually (`useKeyboardHeight` padding in SponsorPage). This has not yet been verified on a device for the double-offset question in #28.

## Implications
- Any new multiline input in the app should follow the same pattern. Don't rely on `onSubmitEditing` or on TextArea's default height.
- If edge-to-edge is ever turned off, `adjustResize` comes back and the manual keyboard padding will double-offset.

## Related
- [[2026-10-06-decision-sponsor-chat-client-cache-model]] — the chat client that uses this input
