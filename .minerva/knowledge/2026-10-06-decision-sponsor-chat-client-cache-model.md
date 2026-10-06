# Sponsor chat client appends replies to the cache and keys pending sends by client id

**Date**: 2026-10-06
**Type**: decision
**Theme**: sponsor-chat
**Summary**: Chat client: per-conversation pending map, clientId-keyed cache append, staleTime Infinity, explicit refetch only.
**Context**: .minerva/work/2026-10-06-sponsor-chat-client (see git history if the worktree has been cleaned up)

## Context
The old client matched optimistic bubbles by content with the wrong role casing. The server returns the Prisma enum `"USER"` but the client compared against `"user"`, so every sent message was duplicated. Pending state was global across conversations, and every send refetched and re-decrypted the whole conversation. The client also had to keep working against two servers: the production server, which persists both messages after generation and returns only `{ response }`, and the post-#25 server, which may persist the user message before generation and add optional response fields.

## Finding
`packages/app/src/providers/ConversationProvider` now works as follows.
- Types come from `inferRouterOutputs<AppRouter>`, so `role` is `"USER" | "MODEL"`.
- Pending sends are kept in a per-conversation map, `pendingByConversation`, mirrored in a ref that acts as the double-send guard.
- On success, the user message is appended to the `conversation.get` cache under the same client id as its pending bubble, followed by the reply built from `response.response`. The rendered list is `cache ∪ pending-not-in-cache-by-id`, so there is no duplicate and no gap regardless of whether the React state update or the query-cache notification renders first. Nothing is matched by content.
- `conversation.get` uses `staleTime: Infinity` with a stable `enabled`. Refetches are explicit only:
  - on selecting a cached conversation that has no send pending;
  - on Retry;
  - after a failed send.
- As a result, a send issues no `get` request, and nothing can refetch a conversation mid-send.
- Server ids and sanitized text replace the client ids on the next open of the conversation.
- Init is lazy and runs once, triggered from SponsorPage's mount. A ref guards it, and `handleError` is read through a ref.

## Implications
- Do not add `invalidateQueries` on `conversation.get` to the send path. It brings back the per-send full re-decrypt, and on a server that persists the user message before generating, a mid-send refetch would show it twice.
- Message ids in the cache can be client ids (`pending-…`, `pending-…-reply`) until the conversation is reopened. Anything that acts on a message id must refetch first. This includes per-message actions such as deletion or editing in Wave 2 (#31).
- Known limitation: if generation fails after the server has persisted the user message, the client shows that message and also restores the draft. Re-sending then duplicates it on the server. This happens on a post-#25 server, or today when saving the model message fails. Streaming (#33) or #31 should deduplicate it, for example with a "retry this message" action keyed by the persisted id.
- An open conversation does not refresh on focus or reconnect. Changes made on another device appear on the next select. The header title falls back to the drawer list's title so the async-generated title still shows up.

## Related
- [[2026-10-06-reference-rn-web-textarea-keyboard]] — input behavior this design relies on
