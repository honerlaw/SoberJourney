# Chat client caches conversations as newest-first infinite pages and classifies failed sends

**Date**: 2026-10-06
**Type**: decision
**Theme**: sponsor-chat
**Summary**: Infinite get/list caches, inverted FlatList, failed sends classified not-saved / saved-unanswered / answered
**Context**: .minerva/work/2026-10-06-conversation-management (see git history if the worktree has been cleaned up)

## Context
Issue #31 added message and drawer pagination, a virtualized message list, delete/rename, and a retry for failed replies on top of the #28 client cache model (id-keyed pending bubbles, `staleTime: Infinity`, explicit refetch only).

## Finding
- `conversation.get` is a TanStack infinite query (`{ conversationId, limit: 30 }`); `pages[0]` is the **newest** page and older pages are appended. The chronological list is the pages reversed and concatenated, de-duplicated by id. Sends append to the end of `pages[0]` under the pending client id, as before. `conversation.list` is an infinite query (`{ limit: 20 }`, opaque cursor), de-duplicated by id. Pure helpers live in `providers/ConversationProvider/conversationCache.ts`, checked by the unit's `verify-conversation-management.ts`.
- Explicit refreshes (select, error-view Retry, failed send, failed retry) cancel in-flight fetches, trim the cache to the newest page and refetch it (`cancelRefetch: true`): one request however far the user scrolled.
- TanStack race facts this relies on: a `fetchNextPage` writes back the pages it captured when it started, so any `setQueryData` made meanwhile is lost; `refetchQueries(..., { cancelRefetch: false })` joins an in-flight page fetch instead of refetching. Hence older-page loads are refused while a send/retry/refresh is pending or the query is fetching, and send/retry/rename cancel page fetches before writing.
- SponsorPage renders an inverted `FlatList` keyed by conversation id (opens at the newest message), loading older pages from `onEndReached` behind those guards.
- A failed send snapshots the server message ids first, then classifies the refetched newest page: `not-saved` (restore the text, error toast), `saved-unanswered` (input clears, the message shows "No reply yet · Retry", softer toast), `answered` (only the response was lost; input clears, error reported but not toasted). The newest USER row counts only if its id is new and its text is exactly what was sent, so an older identical message never counts. `sendMessage` resolves `true` for both saved outcomes.
- Delete treats NOT_FOUND as "already deleted" only after a one-off full `conversation.list` (own cache key) no longer contains it, because the server also maps database errors (and an older server an unknown procedure) to NOT_FOUND. Deleting the active conversation selects the most recent loaded one, or re-runs `getOrCreate`.

## Implications
- A new native build against the previous server degrades gracefully: `list`/`get` ignore `cursor`/`limit`/`direction`, return everything with no `nextCursor`, so paging just ends; `remove`/`rename`/`retrySponsorChat` fail with a toast.
- Anything writing to the `get` cache must cancel in-flight page fetches first or be serialized with them.
- Reopening a cached conversation shows only its newest page; older pages reload on scroll.

## Related
- [[2026-10-06-decision-sponsor-chat-client-cache-model]] — the #28 model this extends
- [[2026-10-06-decision-conversation-rename-and-retry-procedures]] — the server procedures used here
- [[2026-10-06-constraint-tamagui-web-onlongpress-fires-on-click]] — why long-press is native-only in the drawer
