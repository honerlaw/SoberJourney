# Conversation rename and reply retry are new procedures; rename keeps updatedAt, retry never re-saves

**Date**: 2026-10-06
**Type**: decision
**Theme**: sponsor-chat
**Summary**: conversation.rename (raw UPDATE, no updatedAt bump) and retrySponsorChat (newest unanswered USER only)
**Context**: .minerva/work/2026-10-06-conversation-management (see git history if the worktree has been cleaned up)

## Context
Issue #31 asked for a user rename route (auto titles already existed) and Wave 1 (#28) handed over a defect: with persist-before-generate, a failed generation leaves the user message saved while the client restored the typed text, so re-sending duplicated it. Released App Store builds pin the existing procedures (epic #34), so both features had to be additive.

## Finding
- `conversation.rename({ conversationId, title })` normalizes the title (single line, collapsed whitespace, trimmed, clamped to 100 chars at a word boundary), rejects an empty result with BAD_REQUEST, and returns `{ conversation: { id, title, createdAt, updatedAt } }` or NotFound.
- `database/conversation/rename.mts` writes with a parameterized raw `UPDATE "Conversation" SET "title" = … WHERE "id" = … AND "userId" = …` so Prisma's `@updatedAt` is not bumped. Renaming is not activity: it must not reorder the drawer (sorted by `updatedAt`) or move a row across a `listPage` cursor. A Prisma `update` with an explicit old `updatedAt` was rejected because its read-then-write can overwrite a concurrent message's `updatedAt` touch.
- Auto titles never overwrite a rename: the only auto-title writer is `setTitleIfNull` (conditional on null/empty), and a rename always stores a non-empty title. Tests pin both orders.
- `conversation.retrySponsorChat({ conversationId, messageId })` regenerates the reply to the conversation's **newest** message only while it is an unanswered USER row; anything else (answered meanwhile, older message, MODEL id, unknown id) is `CONFLICT` "This message can no longer be retried." The check runs inside the same per-conversation lock as `sponsorChat`, so a retry queued behind an in-flight turn sees that turn's reply. Output matches `sponsorChat` (`response`, `userMessageId`, `modelMessageId`).
- The post-persist half of `runTurn` is the shared `generateReply()` (plus `loadCheckIns()`) in `sponsorChat/runSponsorChat.mts`; `sponsorChat`'s behavior and tests are unchanged.
- Rejected alternatives: an optional retry input on `sponsorChat` (overloads a released procedure), and a two-step add-message + generate-reply send path (rewrites the #28 send path and pre-empts Wave 3 streaming #33). An idempotency key would make saved-state exact but needs a schema migration.

## Implications
- Streaming (#33) can reuse `generateReply`'s shape and should offer the same retry semantics (newest unanswered USER row, CONFLICT otherwise).
- `database/conversation/updateTitle` is now unused by routes (kept; removing it is not additive).
- `list`/`get` inputs must stay non-strict `z.object`s: tRPC's `infiniteQueryOptions` always sends an extra `direction` key.
- Residual risk shared with `sponsorChat`: the lock is best-effort (20s wait, one process), so two concurrent retries from two devices could both generate a reply.

## Related
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — why a failed turn leaves a saved, unanswered USER row
- [[2026-10-06-decision-sponsor-chat-turn-lock]] — the lock retry runs under
- [[2026-10-06-reference-sponsor-chat-backend-surface]] — the pagination and title surfaces this builds on
- [[2026-10-06-decision-chat-client-paginated-cache-and-failed-sends]] — the client side of rename/retry
