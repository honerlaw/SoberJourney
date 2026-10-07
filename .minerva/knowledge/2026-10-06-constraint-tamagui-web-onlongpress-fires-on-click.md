# tamagui on web calls onLongPress on every click of a pressable

**Date**: 2026-10-06
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: tamagui web press handler fires onPress and onLongPress together; set onLongPress native-only
**Context**: .minerva/work/2026-10-06-conversation-management (see git history if the worktree has been cleaned up)

## Context
The conversation drawer row (a tamagui `Card`) got `onPress` (open) and `onLongPress` (rename/delete menu). Code review found that on web a plain click did both.

## Finding
In `@tamagui/web` (1.141.x, `createComponent`), the web press handler wired to `onClick` calls `onPress?.(e)` and then `onLongPress?.(e)` when the target is web. There is no long-press timing on web. The drawer passes `onLongPress` only when `Platform.OS !== "web"` and offers a visible "more" button (with `stopPropagation`) on every platform.

## Implications
- Any tamagui component with both handlers must gate `onLongPress` by platform and provide a discoverable alternative on web.
- `Alert.alert` is a no-op on react-native-web; use a react-native `Modal` (like `AlertModal` or `ConversationActionsModal`) for cross-platform confirmations.

## Related
- [[2026-10-06-decision-chat-client-paginated-cache-and-failed-sends]] — where this surfaced
