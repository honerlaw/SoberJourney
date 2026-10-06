# Sponsor chat persists the user message before calling Gemini and keeps it on failure

**Date**: 2026-10-06
**Type**: decision
**Theme**: sponsor-chat
**Summary**: User message is stored before generation; failed turns leave an unanswered USER row
**Context**: .minerva/work/2026-10-06-sponsor-chat-backend (see git history if the worktree has been cleaned up)

## Context
`conversation.sponsorChat` used to call Gemini first and persist nothing on failure. Released
App Store builds clear the chat input on send and drop the optimistic bubble on error, so a
Gemini outage destroyed what the user typed. Issue #25 asked to keep "not persisting on
failure" (to avoid an orphan bubble reappearing later); unit 001 (never shipped) argued the
opposite. Released apps never receive client fixes.

## Finding
Decided by a 3/3 approach panel: persist the user message (encrypt + `addMessage`, one
`$transaction` with the conversation `updatedAt` touch) before generating, and keep it when
generation fails. The model reply is persisted only when complete; a safety block persists
a fixed supportive fallback (`SAFETY_FALLBACK_REPLY`) and returns it through the normal
`{ response }` shape; a `MAX_TOKENS` reply is never stored. `sponsorChat` additively returns
`userMessageId` and `modelMessageId`. No output shape, enum or error class changed — this is
a behaviour change only.

## Implications
- Released apps show a user bubble with no reply after a failed send (on the next refetch;
  `MessageBubble` compares `role.toLowerCase()`), and a retyped retry appears twice.
- History building must tolerate consecutive USER rows: `buildHistory` merges same-role runs
  and drops leading MODEL rows. Do not assume strict alternation anywhere.
- `buildHistory` drops a blocked turn (USER run followed by a MODEL row equal to the fallback
  constant). Changing the fallback wording stops older blocked turns from being excluded.
- The streaming procedure (#33) should reuse `route/conversation/utils/persistMessage.mts`.
- Persisting first was flagged in the PR for owner review because it overrides #25's text.

## Related
- [[2026-10-06-decision-sponsor-chat-turn-lock]] — the persist → read history → generate → persist reply sequence runs under this lock
- [[2026-10-06-reference-released-app-compatibility]] — how released clients render and react
