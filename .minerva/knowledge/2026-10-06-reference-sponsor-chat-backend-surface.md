# Sponsor chat backend surface: Gemini datasource, pagination and context helpers

**Date**: 2026-10-06
**Type**: reference
**Theme**: sponsor-chat
**Summary**: gemini.chat returns ok/blocked/truncated or throws GeminiError; list/get paginate only on request
**Context**: .minerva/work/2026-10-06-sponsor-chat-backend (see git history if the worktree has been cleaned up)

## Context
Issue #25 reworked the chat backend; Wave 2 (#31 conversation management) and Wave 3
(#33 streaming) build on these surfaces.

## Finding
- `datasource/gemini/chat.mts`: `chat()` returns `{status:"ok",text} | {status:"blocked",reason}
  | {status:"truncated",text}` and throws `GeminiError` (`kind`: `rate_limited` for 429,
  `unavailable` for 5xx, else `unknown`; SDK error kept as `cause`). Blocked = prompt
  `blockReason` or finish reason SAFETY / PROHIBITED_CONTENT / BLOCKLIST / SPII / RECITATION.
  Each call gets a 60s `httpOptions.timeout`; the SDK's `generateContent` path does not retry.
  Model = `GEMINI_MODEL` env or `gemini-2.0-flash` (read in the datasource because
  `util/config.mts` belonged to #27 this wave; not yet in the config schema).
- On gemini-2.5 "thinking" models, thinking tokens count against `maxOutputTokens`; the sponsor
  reply limit (2048) and title limit (32) assume a non-thinking model.
- Route mapping: rate limit → `TOO_MANY_REQUESTS` with a plain message; everything else →
  `InternalServerError("Failed to generate response.")`.
- `conversation.list` accepts an optional `{cursor?, limit?}` (limit clamped 1–100) and
  `conversation.get` optional `cursor?`/`limit?` (1–200). With neither, output is the legacy
  full result plus `nextCursor: null`. `list` cursors are opaque base64url `(updatedAt|id)`
  because `updatedAt` changes on every message; `get` cursors are message ids (keyset on
  immutable `createdAt, id`, newest page first, returned ascending). Unknown cursors give an
  empty page, never an error.
- `conversation.remove` (new) returns `{ conversation: {id,title,createdAt,updatedAt} }`.
- History window: last 40 messages, 48,000 chars (current message always kept), merged
  same-role turns, `maxOutputTokens` 2048. Titles: generated only after an `ok` reply when the
  title is null/empty, sanitized (≤60 chars) and written via `setTitleIfNull`.
- Recent check-ins come from `database/conversation/getRecentCheckInEntries.mts` (`take: 5`),
  placed there only because `database/checkin` belonged to #27 this wave.
- The system prompt gets the user's current date/time (`User.timezone`, UTC fallback) and a
  "Crisis resources" section (see the crisis-guidance decision entry).

## Implications
- Moving `GEMINI_MODEL` into `util/config.mts` and `getRecentCheckInEntries` into
  `database/checkin` are safe follow-ups for the owning buckets.
- New clients paging `list` must treat the cursor as opaque.

## Related
- [[2026-10-06-decision-sponsor-chat-crisis-guidance]] — crisis section of the system prompt
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — fallback and truncation handling
