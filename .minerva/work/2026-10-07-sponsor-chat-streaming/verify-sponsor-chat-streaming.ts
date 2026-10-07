/**
 * Verification script for issue #33's pure streaming helpers.
 *
 * packages/app has no unit-test runner, so this stands in for unit tests
 * (same convention as 2026-10-06-conversation-management). Run from the repo
 * root after `npm ci`:
 *
 *   npx tsx .minerva/work/2026-10-07-sponsor-chat-streaming/verify-sponsor-chat-streaming.ts
 */
import assert from "node:assert/strict";
import {
  applyStreamEvent,
  classifyFailedSend,
  createPendingId,
  INITIAL_STREAM_STATE,
  isMissingProcedureError,
  mergePending,
  mergePendingMessages,
  replyIdFor,
  serverMessageIds,
  STREAM_PROCEDURE_PATH,
  streamingReplyMessage,
  type StreamState,
} from "../../../packages/app/src/providers/ConversationProvider/conversationCache";
import type {
  Message,
  SponsorChatStreamEvent,
} from "../../../packages/app/src/providers/ConversationProvider/ConversationContext";

const at = new Date("2026-10-07T10:00:00Z");
const msg = (id: string, role: Message["role"], content: string): Message => ({
  id,
  role,
  content,
  createdAt: at,
});

const fold = (events: SponsorChatStreamEvent[]): StreamState =>
  events.reduce(applyStreamEvent, INITIAL_STREAM_STATE);

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`ok - ${name}`);
};

// --- pending merge with a streaming reply bubble ---------------------------

check("streaming reply bubble follows the pending user bubble", () => {
  const clientId = createPendingId();
  const cached = [msg("s1", "USER", "hi"), msg("s2", "MODEL", "hello")];
  const user = msg(clientId, "USER", "how are you");
  const reply = streamingReplyMessage(clientId, "I'm", at);
  assert.equal(reply.id, replyIdFor(clientId));
  assert.equal(reply.id, `${clientId}-reply`);
  assert.equal(reply.role, "MODEL");
  const merged = mergePendingMessages(cached, [user, reply]);
  assert.deepEqual(
    merged.map((m) => m.id),
    ["s1", "s2", clientId, `${clientId}-reply`],
  );
});

check("no duplicate once the cache holds both client ids (done appended)", () => {
  const clientId = createPendingId();
  const user = msg(clientId, "USER", "q");
  const finalReply = msg(replyIdFor(clientId), "MODEL", "full answer");
  const cached = [msg("s1", "USER", "a"), user, finalReply];
  const merged = mergePendingMessages(cached, [
    user,
    streamingReplyMessage(clientId, "full", at),
  ]);
  assert.equal(merged, cached);
  // the cached (final) text wins over the streamed partial
  assert.equal(merged.at(-1)!.content, "full answer");
});

check("undefined pending entries are ignored; mergePending unchanged", () => {
  const cached = [msg("s1", "USER", "a")];
  assert.equal(mergePendingMessages(cached, [undefined, undefined]), cached);
  assert.equal(mergePending(cached, undefined), cached);
  const p = msg("pending-x", "USER", "b");
  assert.deepEqual(
    mergePending(cached, p).map((m) => m.id),
    ["s1", "pending-x"],
  );
});

// --- stream event reducer --------------------------------------------------

const done = {
  type: "done",
  response: "You've got this.",
  userMessageId: "u1",
  modelMessageId: "m1",
} as const;

check("events one by one: saved, deltas, done", () => {
  let state = INITIAL_STREAM_STATE;
  state = applyStreamEvent(state, { type: "saved", userMessageId: "u1" });
  assert.equal(state.userMessageId, "u1");
  assert.equal(state.done, null);
  state = applyStreamEvent(state, { type: "delta", text: "You've " });
  state = applyStreamEvent(state, { type: "delta", text: "got" });
  assert.equal(state.replyText, "You've got");
  state = applyStreamEvent(state, done);
  assert.deepEqual(state.done, {
    response: "You've got this.",
    userMessageId: "u1",
    modelMessageId: "m1",
  });
  assert.equal(state.replyText, "You've got this.");
});

check("all events in one burst (a buffering edge) end in the same state", () => {
  const burst = fold([
    { type: "saved", userMessageId: "u1" },
    { type: "delta", text: "You've " },
    { type: "delta", text: "got this." },
    done,
  ]);
  assert.deepEqual(burst.done, {
    response: "You've got this.",
    userMessageId: "u1",
    modelMessageId: "m1",
  });
});

check("done replaces streamed partial text (safety fallback)", () => {
  const state = fold([
    { type: "saved", userMessageId: "u1" },
    { type: "delta", text: "unsafe partial" },
    { ...done, response: "I'm here with you, but ..." },
  ]);
  assert.equal(state.replyText, "I'm here with you, but ...");
  assert.equal(state.done!.response, "I'm here with you, but ...");
});

check("a stream cut before done has no final reply", () => {
  const state = fold([
    { type: "saved", userMessageId: "u1" },
    { type: "delta", text: "par" },
  ]);
  assert.equal(state.done, null);
  assert.equal(state.replyText, "par");
});

check("a late delta after done is ignored", () => {
  const state = fold([done, { type: "delta", text: "x" }]);
  assert.equal(state.replyText, "You've got this.");
});

// --- failure classification after a cut stream ------------------------------

check("stream cut after the reply was persisted resolves to answered", () => {
  const before = [msg("s1", "USER", "a"), msg("s2", "MODEL", "b")];
  const known = serverMessageIds(before);
  const after = [...before, msg("s3", "USER", "help"), msg("s4", "MODEL", "ok")];
  assert.equal(classifyFailedSend(after, "help", known), "answered");
});

check("stream cut after saved but before the reply → saved-unanswered", () => {
  const before = [msg("s1", "USER", "a"), msg("s2", "MODEL", "b")];
  const known = serverMessageIds(before);
  const after = [...before, msg("s3", "USER", "help")];
  assert.equal(classifyFailedSend(after, "help", known), "saved-unanswered");
});

check("stream failed before anything was saved → not-saved", () => {
  const before = [msg("s1", "USER", "help"), msg("s2", "MODEL", "b")];
  const known = serverMessageIds(before);
  assert.equal(classifyFailedSend(before, "help", known), "not-saved");
});

// --- rollout fallback detection ---------------------------------------------

check("missing-procedure detection keys on NOT_FOUND + the stream path", () => {
  // Shape of tRPC's unknown-procedure error data (see the server's
  // streamResponse.test.mts, which pins it against real tRPC output).
  assert.equal(
    isMissingProcedureError({
      code: "NOT_FOUND",
      httpStatus: 404,
      path: STREAM_PROCEDURE_PATH,
    } as { code: string; path: string }),
    true,
  );
  assert.equal(STREAM_PROCEDURE_PATH, "conversation.streamSponsorChat");
  assert.equal(
    isMissingProcedureError({ code: "NOT_FOUND", path: "conversation.get" }),
    false,
  );
  assert.equal(
    isMissingProcedureError({
      code: "INTERNAL_SERVER_ERROR",
      path: STREAM_PROCEDURE_PATH,
    }),
    false,
  );
  assert.equal(
    isMissingProcedureError({
      code: "TOO_MANY_REQUESTS",
      path: STREAM_PROCEDURE_PATH,
    }),
    false,
  );
  assert.equal(isMissingProcedureError(undefined), false);
  assert.equal(isMissingProcedureError(null), false);
});

console.log(`\n${checks} checks passed`);
