# Sponsor chat turns are serialized per conversation by a best-effort in-process lock

**Date**: 2026-10-06
**Type**: decision
**Theme**: sponsor-chat
**Summary**: In-process per-conversation lock, 20s bounded wait; no DB lock held during generation
**Context**: .minerva/work/2026-10-06-sponsor-chat-backend (see git history if the worktree has been cleaned up)

## Context
Concurrent sends to one conversation interleaved history (U1, U2, M1, M2). Issue #25 preferred
serializing over rejecting so released apps never see a new error type. A Postgres lock held
for the whole turn would pin a pooled connection idle for up to the Gemini timeout (pg Pool
default max 10; small managed Postgres plans allow ~22 connections), and a `FOR UPDATE` on the
conversation row self-deadlocks with `addMessage`'s `updatedAt` touch from another connection.

## Finding
`route/conversation/utils/conversationLock.mts` chains promises per conversation id. The
critical section is the whole turn: ownership check → persist user message → read history →
generate → persist reply, released in `finally`. A waiter waits at most `LOCK_WAIT_MS`
(20s) and then proceeds unserialized, keeping the queue under the ~100s Cloudflare limit
(20s + 60s Gemini timeout). A timed-out waiter keeps its place in the chain, so newer callers
still queue behind the in-flight turn. `conversation.remove` takes the same lock.
`getOrCreate` uses a short `pg_advisory_xact_lock(hashtext('conversation:getOrCreate:'||userId))`
transaction instead (two quick queries, no pool concern); verified against real Postgres
(10 concurrent calls → one conversation).

## Implications
- Only one server process is serialized. If DO App Platform is scaled above one instance,
  turns can interleave across instances (history still valid via merge, never an error);
  revisit with an advisory lock on a budgeted dedicated connection or a schema-backed lease.
- History is read after persisting the user message, so even unserialized turns see every
  committed user row.
- Message order is `createdAt` then `id` everywhere in `database/conversation`.

## Related
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — the turn sequence this lock protects
