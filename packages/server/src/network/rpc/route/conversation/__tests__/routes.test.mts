import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { router } from "../../../router.mjs";
import { list, listConversationsInput } from "../list.mjs";
import { get } from "../get.mjs";
import { remove } from "../remove.mjs";
import { rename, normalizeRenameTitle } from "../rename.mjs";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const appRouter = router({ list, get, remove, rename });

const conv = (id: string, title: string | null, n: number) => ({
  id,
  userId: "user-1",
  title,
  createdAt: new Date(n),
  updatedAt: new Date(n + 1),
});
const msg = (
  id: string,
  role: "USER" | "MODEL",
  content: string,
  n: number,
) => ({
  id,
  conversationId: CONVERSATION_ID,
  role,
  content,
  createdAt: new Date(n),
  updatedAt: new Date(n),
});

function caller(conversation: Record<string, unknown>) {
  const ctx = {
    auth: { user: { id: "user-1" } },
    database: { conversation },
    service: {
      encryption: {
        DEKIdentifier: { CONVERSATION: "conversation" },
        decrypt: async (_c: unknown, _i: unknown, text: string) =>
          text.replace(/^enc:/, ""),
      },
    },
  };
  return appRouter.createCaller(ctx as never);
}

describe("conversation.list", () => {
  it("accepts no input (released apps) and returns today's full list plus nextCursor: null", async () => {
    assert.equal(listConversationsInput.parse(undefined), undefined);
    const listFn = mock.fn(async () => [
      conv("a", null, 1),
      conv("b", "Titled", 2),
    ]);
    const listPage = mock.fn(async () => ({
      conversations: [],
      nextCursor: null,
    }));
    const result = await caller({ list: listFn, listPage }).list();
    assert.deepEqual(result, {
      conversations: [
        {
          id: "a",
          title: "New conversation",
          createdAt: new Date(1),
          updatedAt: new Date(2),
        },
        {
          id: "b",
          title: "Titled",
          createdAt: new Date(2),
          updatedAt: new Date(3),
        },
      ],
      nextCursor: null,
    });
    assert.equal(listPage.mock.callCount(), 0);
  });

  it("paginates only when asked, clamping the limit", async () => {
    const listFn = mock.fn(async () => []);
    const listPage = mock.fn(async () => ({
      conversations: [conv("c", null, 5)],
      nextCursor: "c",
    }));
    const result = await caller({ list: listFn, listPage }).list({
      limit: 5000,
      cursor: "x",
    });
    assert.equal(listFn.mock.callCount(), 0);
    assert.deepEqual(listPage.mock.calls[0]!.arguments, [
      "user-1",
      { cursor: "x", limit: 100 },
    ]);
    assert.equal(result.nextCursor, "c");
    assert.equal(result.conversations[0]!.title, "New conversation");
  });
});

describe("conversation.get", () => {
  it("without pagination returns all messages decrypted, same fields as before plus nextCursor", async () => {
    const getFn = mock.fn(async () => ({
      ...conv(CONVERSATION_ID, null, 1),
      messages: [
        msg("m1", "USER", "enc:hi", 1),
        msg("m2", "MODEL", "enc:hello", 2),
      ],
    }));
    const getMessagesPage = mock.fn();
    const result = await caller({ get: getFn, getMessagesPage }).get({
      conversationId: CONVERSATION_ID,
    });
    assert.deepEqual(result, {
      conversation: {
        id: CONVERSATION_ID,
        title: null,
        createdAt: new Date(1),
        updatedAt: new Date(2),
        messages: [
          { id: "m1", role: "USER", content: "hi", createdAt: new Date(1) },
          { id: "m2", role: "MODEL", content: "hello", createdAt: new Date(2) },
        ],
        nextCursor: null,
      },
    });
    assert.equal(getMessagesPage.mock.callCount(), 0);
  });

  it("with a limit returns a page and nextCursor", async () => {
    const getMessagesPage = mock.fn(async () => ({
      conversation: conv(CONVERSATION_ID, "T", 1),
      messages: [msg("m2", "MODEL", "enc:hello", 2)],
      nextCursor: "m2",
    }));
    const result = await caller({ get: mock.fn(), getMessagesPage }).get({
      conversationId: CONVERSATION_ID,
      limit: 1,
    });
    assert.deepEqual(getMessagesPage.mock.calls[0]!.arguments, [
      CONVERSATION_ID,
      "user-1",
      { cursor: undefined, limit: 1 },
    ]);
    assert.equal(result.conversation.nextCursor, "m2");
    assert.deepEqual(
      result.conversation.messages.map((m) => m.content),
      ["hello"],
    );
  });

  it("returns NOT_FOUND for a missing conversation", async () => {
    await assert.rejects(
      caller({ get: async () => null }).get({
        conversationId: CONVERSATION_ID,
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "NOT_FOUND",
    );
  });
});

describe("conversation.remove", () => {
  it("removes an owned conversation and returns it", async () => {
    const removeFn = mock.fn(async () => conv(CONVERSATION_ID, "T", 1));
    const result = await caller({ remove: removeFn }).remove({
      conversationId: CONVERSATION_ID,
    });
    assert.deepEqual(removeFn.mock.calls[0]!.arguments, [
      CONVERSATION_ID,
      "user-1",
    ]);
    assert.deepEqual(result, {
      conversation: {
        id: CONVERSATION_ID,
        title: "T",
        createdAt: new Date(1),
        updatedAt: new Date(2),
      },
    });
  });

  it("returns NOT_FOUND when missing or not owned", async () => {
    await assert.rejects(
      caller({ remove: async () => null }).remove({
        conversationId: CONVERSATION_ID,
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "NOT_FOUND",
    );
  });
});

describe("conversation.rename", () => {
  it("normalizes the title and returns the conversation", async () => {
    const renameFn = mock.fn(
      async (_id: string, _user: string, title: string) => ({
        ...conv(CONVERSATION_ID, title, 1),
      }),
    );
    const result = await caller({ rename: renameFn }).rename({
      conversationId: CONVERSATION_ID,
      title: "  My\n  sober   plan \t ",
    });
    assert.deepEqual(renameFn.mock.calls[0]!.arguments, [
      CONVERSATION_ID,
      "user-1",
      "My sober plan",
    ]);
    assert.deepEqual(result, {
      conversation: {
        id: CONVERSATION_ID,
        title: "My sober plan",
        createdAt: new Date(1),
        updatedAt: new Date(2),
      },
    });
  });

  it("clamps an over-long title at a word boundary instead of rejecting it", () => {
    const long = "word ".repeat(40);
    const title = normalizeRenameTitle(long);
    assert.ok(title.length <= 100);
    assert.ok(!title.endsWith(" "));
    assert.equal(normalizeRenameTitle("x".repeat(150)).length, 100);
  });

  it("rejects an empty title with BAD_REQUEST (never UNAUTHORIZED)", async () => {
    const renameFn = mock.fn();
    await assert.rejects(
      caller({ rename: renameFn }).rename({
        conversationId: CONVERSATION_ID,
        title: " \n ",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "BAD_REQUEST",
    );
    assert.equal(renameFn.mock.callCount(), 0);
  });

  it("returns NOT_FOUND when missing or not owned", async () => {
    await assert.rejects(
      caller({ rename: async () => null }).rename({
        conversationId: CONVERSATION_ID,
        title: "x",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "NOT_FOUND",
    );
  });
});
