# Proposal: sponsor-chat-backend

**Date**: 2026-10-06
**Status**: Draft
**Closes**: #25

## Goal

Make the Sponsor chat backend correct and resilient without breaking any released App Store build: no lost user messages, bounded and correctly-ordered history, accurate check-in context, graceful handling of Gemini safety blocks / truncation / rate limits, a safe title generator, and the additive API surface (`conversation.remove`, optional pagination) that Wave 2 (#31) and Wave 3 (#33) build on.

## Why

GitHub issue #25 (audit epic #34) lists the defects, verified against the code on `epic/audit-wave-1`:

- `formatUrge` treats the 1–10 check-in scale (`checkin/create.mts:50`, `UrgeMeter.tsx` slider min 1 max 10, "Non-existent" → "Critical") as 1–5, so urge ≥5 is reported to the model as "intense".
- `sponsorChat/index.mts:46-65` decrypts and sends the **entire** conversation to Gemini every turn with no `maxOutputTokens`.
- `sponsorChat/index.mts:77-117` calls Gemini **before** persisting anything; a Gemini failure loses the user's message entirely (released `ChatInput` already cleared the text, released `ConversationProvider` drops the optimistic bubble on error). Unit 001 (`.minerva/worktrees/001-sponsor-chat-streaming`, panel-reviewed, never shipped) identified this as the data-loss bug that prompted its work.
- Concurrent sends to one conversation interleave (U1,U2,M1,M2); `database/conversation/get.mts:18-21` orders by `createdAt` only.
- `getOrCreate` is find-then-create and races into duplicate empty conversations.
- `datasource/gemini/chat.mts` swallows every error into `null`; safety blocks return `undefined` text; everything surfaces as `InternalServerError("Failed to generate response.")`. Truncated (`MAX_TOKENS`) replies are saved as if complete. The model name is hardcoded.
- `generateTitle` is a floating promise (unhandled rejection risk), runs before the chat succeeds, on every send while the title is null, and stores unbounded / unsanitized model output with an unconditional update.
- The system prompt has no notion of "now"; `formatCheckInAge` uses 24h buckets not calendar days; `formatDuration` yields "12 months" / "1 year and 12 months" for days 360–364; all check-in entries are fetched then sliced to 5.
- The prompt-injection "sanitizer" silently deletes user text like `<<draft>>` / `[[note]]`. Gemini receives user text as a structured `role: "user"` part, so other models' chat-template tokens carry no special meaning — the stripping corrupts text without protecting anything.

## Approach

All changes stay inside this unit's file ownership: `packages/server/src/network/rpc/route/conversation/**`, `packages/server/src/database/conversation/**`, `packages/server/src/datasource/gemini/**`. No prisma schema, no `service/encryption`, no `context.mts`, no `util/config.mts`, no `database/checkin`. New `database/conversation/*` and `datasource/gemini/*` exports are picked up automatically by `context.mts`'s `wrap(...)` (it partially applies `logger`/`client` to every exported function), so every new export from those index files must be a function.

### A. Persistence order — persist the user message before generating (resolves the #25 vs. unit-001 conflict)

**Decision: persist the user message before calling Gemini, and keep it when generation fails** (unit 001's position), overriding #25's "keep not persisting the user message when Gemini fails".

Reasoning under the epic's API compatibility rules:
- No output shape, enum, nullability or error class changes (rules 3/4). The only behaviour difference is that a failed turn leaves a `USER` row without a following `MODEL` row.
- How a released app renders that row: `MessageBubble.tsx:15` compares `message.role.toLowerCase() === "user"`, so a persisted `"USER"` row renders as an ordinary right-aligned user bubble. The released provider drops its optimistic bubble on error and does **not** refetch on error, so the orphan appears on the next refetch (next successful send, or re-opening the conversation) as a user bubble with no reply directly before the user's retry. The released dedupe compares `role === "user"` against the server's `"USER"` and never matches (the #28 duplicate bug); that is pre-existing and unaffected by this choice.
- Trade-off: #25's concern is that an orphan "reappears later" after the user saw the send fail. Unit 001's concern is that the text is otherwise lost forever (released `ChatInput` cleared it; released apps never get the #28 input-restore fix). Losing what a person in recovery typed in a hard moment is worse than one visible unanswered bubble, and the persisted text is recoverable (copyable) by the user. Rule 7 / "released apps never get client-side fixes, so prefer server-side mitigations" favours the server-side fix that protects released apps immediately.
- History tolerates the orphan: the next turn's history contains `USER, USER` which is merged into one user turn (required by #25 anyway, since such rows can already exist), so the model answers both.
- The safety-block change (C) removes the most common "failure" class from the error path entirely, so orphans arise only on genuine outages / rate limits / truncation.

**This consciously overrides the #25 checkbox** ("Keep today's behavior of *not* persisting the user message when Gemini fails"). It is a behaviour change with **no contract change** (no output, enum, nullability or error-class change). Consequences for released apps, named in the PR body and flagged for owner review: (1) a "ghost" user bubble with no reply appears on the next refetch after a failed send; (2) if the user retypes and resends the same text, it appears twice in the conversation (two consecutive USER rows, which the model sees merged into one turn). Decided by a 3/3 approach panel (see scratchpad).

"Atomic" (#25 item) is reinterpreted accordingly. Today `addMessage` is three separate calls (ownership `findFirst`, `conversationMessage.create`, `conversation.update` for `updatedAt`), so a failed `updatedAt` touch returns `null` after the row already exists. This unit wraps all three in one `$transaction` so a message row and its `updatedAt` touch commit together or not at all. The model reply is persisted only after a complete, non-truncated reply (or the safety fallback). There is no window in which a model reply exists without its user message.

Reusable encrypt-and-store module (from 001): `route/conversation/utils/persistMessage.mts` — `persistMessage(ctx, conversationId, role, text)` encrypts with the CONVERSATION DEK and calls `ctx.database.conversation.addMessage`, throwing `InternalServerError` on a null result. Used by `sponsorChat` now and by #33's streaming procedure later.

The turn itself moves into a plain function `route/conversation/sponsorChat/runSponsorChat.mts` (`runSponsorChat(ctx, input)`) that the tRPC procedure calls, so it can be unit-tested with a mocked `ctx` without standing up tRPC.

### B. Concurrency, ordering, getOrCreate

- **Per-conversation turn serialization: in-process async mutex, best-effort** (`route/conversation/utils/conversationLock.mts`, a `Map<conversationId, Promise>` chain, entries deleted when idle). The critical section is the whole turn: persist user message → history read → generate → persist reply, released in `try/finally` so a thrown error never leaks or deadlocks the lock. A second send to the same conversation waits for the first turn to finish, then builds history that includes U1/M1. No new error type is ever returned (issue: "prefer serializing over rejecting"). This only partly honours the issue's "row lock" preference (see alternatives).
  - **Bounded wait**: a waiter waits at most `LOCK_WAIT_MS` (20s) and then proceeds unserialized (logged), so a queued send never stacks two full Gemini timeouts and stays under the ~100s Cloudflare proxy limit (20s wait + 60s generation). Proceeding unserialized degrades exactly like the multi-instance case (below): never an error.
  - Each Gemini call is bounded by an HTTP timeout enforced in `datasource/gemini` (60s, `httpOptions.timeout`; the SDK does no automatic retries, so this is a total bound per call).
  - `conversation.remove` takes the same lock (with the same bounded wait), so a delete does not race an in-flight turn into a 500; if a reply persist still fails because the conversation vanished, the turn throws the existing `InternalServerError`.
  - Alternatives considered: (1) a Postgres advisory / `SELECT … FOR UPDATE` lock held in an interactive transaction for the whole turn — correct across instances, but holds a pooled connection idle for up to the Gemini timeout per in-flight turn (pg pool default max 10; DO managed Postgres small plans allow ~22 connections), so 10 concurrent chats would stall every other query in the server; a `FOR UPDATE` on the conversation row would also self-deadlock with `addMessage`'s `updatedAt` touch from another connection. (2) Reject with `CONFLICT` — the issue disfavours a new error type for released apps.
  - Known gap, stated in the PR: if production ever runs >1 server instance, two sends routed to different instances can still interleave. That degrades gracefully: deterministic ordering + same-role merge keep history valid; nothing errors. Production topology (Cloudflare → DO App Platform → Express) was verified by unit 001; instance count is not visible from the repo.
- **Deterministic ordering**: `database/conversation/get.mts` orders messages by `[{ createdAt: "asc" }, { id: "asc" }]`; every new message query uses the same order.
- **getOrCreate race**: run find-then-create inside a short `$transaction` that first takes `pg_advisory_xact_lock(hashtext('conversation:getOrCreate:' || userId))`. Short-lived (two queries), so no pool concern. Output unchanged. (`DBClient` is `typeof client`, the full `PrismaClient`, so `$transaction` / `$executeRaw` are available — checked in `util/database.mts`.) Unit-tested with a mocked client: the lock statement runs inside the transaction before the find.

### C. Gemini datasource

`datasource/gemini/chat.mts` returns a structured result instead of `string | null | undefined`:
`{ status: "ok", text } | { status: "blocked", reason } | { status: "truncated", text }`, and **throws** a `GeminiError` (with the SDK error as `cause`, plus `kind: "rate_limited" | "unavailable" | "unknown"` from `ApiError.status` 429 / 5xx / other) instead of logging and returning `null`. Blocked = `promptFeedback.blockReason` set, or `finishReason` in {SAFETY, PROHIBITED_CONTENT, BLOCKLIST, SPII, RECITATION}, or empty text with no other explanation is treated as `unknown` error. Model name configurable: `process.env.GEMINI_MODEL ?? "gemini-2.0-flash"` read inside the gemini datasource (not via `util/config.mts`, owned by #27); per-call override kept. Default request timeout 60s via `httpOptions.timeout`. Only two consumers exist (`sponsorChat`, `generateTitle`); both are updated.

Route mapping in `runSponsorChat`:
- `ok` → persist model reply, return.
- `blocked` → return a fixed supportive fallback reply **through the normal `{ response }` success shape** and persist it as the `MODEL` message (the user sees it again on refetch; history rows stay paired). Fallback text does not add crisis-resource language (the crisis-guidance product decision is out of scope; see Open Questions). **`buildHistory` excludes blocked turns**: a USER row (or merged run of USER rows) immediately followed by a MODEL row whose text equals the fallback constant is dropped together with that fallback row, so a blocked prompt is not re-sent on every later turn and does not poison the conversation. Detection keys on exact equality with the exported fallback constant (no schema column is available this wave); an earlier unanswered USER row merged into the same run is dropped with it, intentionally (it is part of the same unanswered user turn), and this is tested. `RECITATION` is treated as blocked for the same reason: the reply cannot be used, and the supportive fallback is better than a 500.
- `truncated` → do not persist the partial reply; throw `InternalServerError` with a plain message ("The response was cut off. Please try again."). `maxOutputTokens` is set to 2048 (sponsor replies are instructed to be short), so this is rare.
- thrown `rate_limited` → `TRPCError({ code: "TOO_MANY_REQUESTS", message: "The sponsor is getting a lot of messages right now. Please try again in a moment." })`; anything else → `InternalServerError("Failed to generate response.")` (today's message). Never `UNAUTHORIZED`; messages stay plain strings.

### D. History window

`route/conversation/sponsorChat/utils/buildHistory.mts` (pure, unit-tested):
- New DB function `database/conversation/getRecentMessages.mts` loads only the last `HISTORY_MAX_MESSAGES` (40) rows, newest first, tiebreak `id`, so only windowed rows are decrypted.
- After decrypt: keep the newest messages whose cumulative text length ≤ `HISTORY_MAX_CHARS` (48,000 chars ≈ 12k tokens; the current 16,000-char user message is always included on top), drop leading `model` turns so history starts with `user`, and merge consecutive same-role turns (joined with a blank line). Because the new user message is persisted *before* the history read (inside the turn lock), history is built purely from persisted rows; the just-persisted message is always the newest row and is always included regardless of the char budget. An earlier unanswered user message (orphan from a failed turn) merges into the same final user turn.
- `maxOutputTokens: 2048` on the chat call.

### E. Title generation

- Runs only **after** a successful reply (`ok` status; not on fallback/failure), only when the conversation title was null at load, and is fire-and-forget with a real `.catch()` that logs (no unhandled rejection; does not delay the response).
- Output sanitized: strip surrounding/embedded quotes and backticks, collapse newlines/whitespace, strip trailing punctuation, cap at 60 chars (word boundary); empty → skip.
- New DB function `database/conversation/setTitleIfNull.mts` does `updateMany({ where: { id, userId, title: null }, data: { title } })` so a racing second generation never overwrites the first. `updateTitle` is left unchanged (other consumers / #31 rename).
- Returned `title` values and nullability on every route are unchanged.

### F. Prompt / context quality

- System prompt gains a "Current date and time for the user: <weekday, Month D, YYYY, h:mm AM/PM> (<timezone>)" line using `ctx.auth.user.timezone`, falling back to UTC if `Intl` rejects the stored zone.
- `formatUrge` rescaled to 1–10: <2 none, <4 mild, <6 moderate, <8 strong, <10 intense, 10 critical, and rendered with the number (e.g. "strong (7/10)"); fractional averages handled.
- `formatCheckInAge(date, now, timeZone)`: under 1h "just now"; same calendar day in the user's zone "N hours ago"/"earlier today"; previous calendar day "yesterday"; else "N days ago" by calendar-day difference.
- `formatDuration`: clamp months to 11 (no "12 months", no "1 year and 12 months").
- Recent check-ins: new `database/conversation/getRecentCheckInEntries.mts` does `journeyCheckInEntry.findMany({ where: { checkIn: { journeyId, userId } }, orderBy: [{createdAt: "desc"}, {id: "desc"}], take: 5 })` — lives under `database/conversation` because `database/checkin` belongs to #27 this wave; a comment says so.
- Sanitizer: stop deleting `<<…>>`, `[[…]]`, `<|…|>` patterns; keep `trim()`, the 1-char minimum and the 16,000-char maximum (limit must not shrink; validation only loosens, never tightens).
- `systemPrompt.mts` crisis-hotline guidance is **not changed** (product decision for the owner).

### G. Additive API surface

- `conversation.remove` (new mutation): input `{ conversationId: uuid }`; output `{ conversation: { id, title, createdAt, updatedAt } }` (same shape as `create`); `NotFoundError` when missing / not owned. Wraps the existing `database/conversation/remove.mts`, which returns `null` for both "not found" and a DB error — the route maps both to `NotFoundError` (documented in code; `remove.mts` itself is unchanged).
- `conversation.list`: new **optional** input `{ cursor?: string, limit?: number }` (the whole input object `.optional()`, since released apps call it with no input — verified by a test that parses `undefined`). Omitted → today's full list, same order, same mapping (`title || "New conversation"` kept). With `limit` (clamped to 1–100): keyset page ordered `updatedAt desc, id desc`, starting after `cursor`. A `cursor` that is not one of the user's conversations yields an empty page with `nextCursor: null` (no new error). Output adds `nextCursor: string | null` alongside `conversations` (always `null` when not paginating).
- `conversation.get`: new **optional** `cursor?` (message id) and `limit?` (clamped 1–200). Omitted → all messages ascending (today). With `limit`: the newest `limit` messages strictly older than `cursor` (keyset on `createdAt, id`), returned in ascending order; `nextCursor` = id of the oldest returned message when older ones exist, else `null`. A cursor not in this conversation yields an empty page with `nextCursor: null` (no new error). Output adds `conversation.nextCursor` alongside `messages`.
- `conversation.sponsorChat`: input unchanged; output adds `userMessageId` and `modelMessageId` alongside `response` (001's additive field).
- API contract: additive only. Changed procedures: `sponsorChat` (output +2 fields), `list` (optional input, output +`nextCursor`), `get` (optional input fields, output +`conversation.nextCursor`), new `remove`. Error classes unchanged except a new `TOO_MANY_REQUESTS` on Gemini rate limit (previously `INTERNAL_SERVER_ERROR`; released apps treat any non-401 error the same way).

### Tests (node:test, `packages/server`)

Unit: `formatUrge`, `formatDuration` (incl. 360–364 days), `formatCheckInAge` calendar buckets + tz, `buildHistory` (window, char budget, leading-model drop, same-role merge incl. a trailing unanswered USER row and a window boundary that cuts mid-run, blocked-turn exclusion), title sanitizer, `conversationLock` (serialization, release after a thrown error, bounded wait), `gemini.chat` result classification + error cause (mocked client). Route-level `runSponsorChat` with mocked `ctx`: user message persisted before Gemini is invoked; Gemini throw leaves the user message persisted and maps to the right error; safety block → success shape with fallback, persisted; truncated → not persisted, error; return includes `userMessageId`/`modelMessageId`; `generateTitle` rejection does not surface as unhandled rejection; title only generated after success. Pagination: default (no params) mapping identical to today; the `list` input schema accepts `undefined`; paged path returns `nextCursor`; unknown cursor → empty page. `getOrCreate` takes the advisory lock inside its transaction (mocked client).

## Success criteria

- `npm run build`, `npm run test`, and server `npm run lint` pass in the worktree.
- `formatUrge` maps the 1–10 scale (urge 5 is not "intense"; 10 is the top bucket); unit-tested.
- `formatDuration` never produces "12 months"; unit-tested for 360–364 and 729 days.
- History sent to Gemini is bounded by message count and character budget, starts with a user turn, has no consecutive same-role turns; `maxOutputTokens` is set; unit-tested.
- `runSponsorChat` persists the user message before invoking Gemini, and a Gemini failure leaves it persisted (tested).
- A Gemini safety block returns `{ response: <supportive fallback> }` (success shape, not an error) (tested).
- A `MAX_TOKENS` reply is not persisted (tested).
- Rate-limit errors map to `TOO_MANY_REQUESTS`; no code path in this unit throws `UNAUTHORIZED` except the existing auth guards (grep).
- `gemini.chat` no longer returns `null` on error; the thrown error carries the SDK error as `cause` (tested).
- `generateTitle` runs only after a successful reply, cannot cause an unhandled rejection, sanitizes/caps the title, and writes via a conditional `title: null` update (tested).
- Concurrent `runSponsorChat` calls on the same conversation execute sequentially for up to 20s of queueing (best-effort: after the bounded wait a waiter proceeds unserialized); the lock is released when the turn throws; a timed-out waiter does not remove or replace the in-flight turn's chain entry, so later waiters still queue behind it (tested via `conversationLock`).
- A blocked turn (USER row followed by the fallback MODEL row) is excluded from later history (tested in `buildHistory`).
- Message ordering uses `createdAt` then `id` everywhere in `database/conversation`.
- `getOrCreate` find-then-create runs under a per-user advisory transaction lock.
- `conversation.remove` exists; `list`/`get` accept optional `cursor`/`limit`, and with neither supplied return the same fields/values as before plus only the new `nextCursor` field (tested at the mapping level).
- `sponsorChat` returns `{ response, userMessageId, modelMessageId }`.
- The system prompt includes the current date/time in the user's timezone; `systemPrompt.mts` crisis-hotline guidance is byte-for-byte unchanged.
- The sanitizer no longer deletes `<<…>>` / `[[…]]` / `<|…|>` text; 16,000-char max unchanged.
- No files changed outside the three owned directories (plus `.minerva/` records).
- The PR body lists a manual smoke check for the owner (the interactive `$transaction` in `addMessage` and the `pg_advisory_xact_lock` in `getOrCreate` run against a real Postgres through the Prisma pg adapter; send a chat message and open the app once), unless it was run locally against a real database.
- The PR body states "API contract: additive only", lists every changed procedure (epic rule 8), and flags the persist-before-generate override of the #25 checkbox for owner review.

## Open Questions

- **Product decision (owner):** `systemPrompt.mts:6` tells the model not to suggest crisis hotlines unless the user explicitly says they are in crisis. Out of scope; reported to the owner. The safety-block fallback text likewise avoids hotline language pending that decision.
- Multi-instance deployment: the turn lock assumes a single server instance. If DO App Platform runs >1 instance, it does not serialize across instances (degrades to merged history, never an error). **Revisit trigger:** if the app is scaled above one instance, move to a Postgres advisory lock with a dedicated, budgeted connection or a schema-backed lease (schema owned by #27).
- `GEMINI_MODEL` is read from `process.env` inside `datasource/gemini` because `util/config.mts` is owned by #27 this wave; a follow-up should move it into the config schema and document it.
- Adding the current time to the system prompt makes each system prompt unique per minute (no implicit prompt-cache reuse); accepted for correctness.
- **Owner review:** the persist-before-generate override of the #25 checkbox.
- When to remove legacy `sponsorChat` once #33 streaming ships (a #33/#31 concern).
