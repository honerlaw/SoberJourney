# How released app builds consume the conversation API

**Date**: 2026-10-06
**Type**: reference
**Theme**: server
**Summary**: Released apps log out on 401 or token-error messages; roles compare case-insensitively when rendering
**Context**: .minerva/work/2026-10-06-sponsor-chat-backend (see git history if the worktree has been cleaned up)

## Context
Epic #34 binds every server change to keep App Store builds working. These facts about the
released client were verified while changing the chat backend.

## Finding
- The released app logs the user out on `UNAUTHORIZED`, HTTP 401, or an error message
  containing "Token expired" or "Invalid token". Mutations never retry; queries retry up to
  3 times on non-auth errors. Client and server both use superjson.
- `conversation.list` is called with no input (`undefined`); adding `.optional()` input keeps
  that call valid.
- `MessageBubble` renders `role.toLowerCase() === "user"`, so server `"USER"`/`"MODEL"` render
  correctly; `ConversationProvider` dedupes its pending bubble with `role === "user"`, which
  never matches `"USER"` (the duplicate-bubble bug fixed client-side in #28).
- On a send error the released provider drops the optimistic bubble and does not refetch;
  `ChatInput` has already cleared the text.
- `User.timezone` is non-null (default "America/New_York") and set from `x-iana-time-zone`.
  Check-in `urge` is 1–10 (the Prisma comment saying 1–5 is stale).

## Implications
- Never introduce error messages containing "Token expired"/"Invalid token" outside auth.
- Prefer server-side mitigations: released builds never get client fixes.

## Related
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — relies on the rendering facts above
