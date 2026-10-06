import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { mockLogger } from "../../../../../../util/__mocks__/logger.mjs";
import {
  GeminiError,
  type ChatResult,
} from "../../../../../../datasource/gemini/chat.mjs";
import { runSponsorChat, MAX_OUTPUT_TOKENS } from "../runSponsorChat.mjs";
import { SAFETY_FALLBACK_REPLY } from "../utils/fallback.mjs";

type Ctx = Parameters<typeof runSponsorChat>[0];

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

type Row = {
  id: string;
  role: "USER" | "MODEL";
  content: string;
  createdAt: Date;
};

function harness(options: {
  chat: () => Promise<ChatResult>;
  title?: string | null;
  existing?: Row[];
  conversationExists?: boolean;
  titleChat?: () => Promise<ChatResult>;
}) {
  const events: string[] = [];
  const stored: Row[] = [...(options.existing ?? [])];
  let nextId = 1;
  const { logger, mocked: loggerMock } = mockLogger();

  const addMessage = mock.fn(
    async (_c: string, _u: string, role: "USER" | "MODEL", content: string) => {
      events.push(`persist:${role}`);
      const row = { id: `m${nextId++}`, role, content, createdAt: new Date() };
      stored.push(row);
      return row;
    },
  );
  const setTitleIfNull = mock.fn(async () => {
    events.push("title:set");
    return true;
  });
  const chat = mock.fn(
    async (contents: unknown, config: { systemInstruction?: string }) => {
      // the title generator uses its own system prompt
      if (config.systemInstruction?.startsWith("You are a title generator")) {
        events.push("gemini:title");
        return (
          options.titleChat ??
          (async () => ({ status: "ok", text: "Hope" }) as ChatResult)
        )();
      }
      events.push("gemini:chat");
      return options.chat();
    },
  );

  const ctx = {
    logger,
    auth: { user: { id: "user-1", timezone: "America/New_York" } },
    datasource: { gemini: { chat } },
    database: {
      journey: {
        list: mock.fn(async () => [
          {
            id: "j1",
            title: "Alcohol",
            entries: [{ createdAt: new Date(Date.now() - 10 * 86400000) }],
          },
        ]),
      },
      conversation: {
        getMessagesPage: mock.fn(async () => {
          events.push("load");
          if (options.conversationExists === false) return null;
          return {
            conversation: { id: CONVERSATION_ID, title: options.title ?? null },
            messages: [...(options.existing ?? [])],
            nextCursor: null,
          };
        }),
        getRecentCheckInEntries: mock.fn(async () => [
          {
            mood: "SAD",
            urge: 7,
            createdAt: new Date(Date.now() - 2 * 3600000),
          },
        ]),
        addMessage,
        setTitleIfNull,
      },
    },
    service: {
      encryption: {
        DEKIdentifier: { CONVERSATION: "conversation" },
        encrypt: mock.fn(
          async (_ctx: unknown, _id: unknown, text: string) => `enc:${text}`,
        ),
        decrypt: mock.fn(async (_ctx: unknown, _id: unknown, text: string) =>
          text.replace(/^enc:/, ""),
        ),
      },
    },
  } as unknown as Ctx;

  return { ctx, events, stored, chat, addMessage, setTitleIfNull, loggerMock };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("runSponsorChat", () => {
  it("persists the user message before generating and returns both message ids", async () => {
    const h = harness({
      chat: async () => ({ status: "ok", text: "You've got this." }),
    });
    const result = await runSponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      text: "I feel an urge",
    });

    assert.deepEqual(result, {
      response: "You've got this.",
      userMessageId: "m1",
      modelMessageId: "m2",
    });
    assert.deepEqual(h.events.slice(0, 4), [
      "load",
      "persist:USER",
      "gemini:chat",
      "persist:MODEL",
    ]);
    assert.equal(h.stored[0]!.content, "enc:I feel an urge");
    assert.equal(h.stored[1]!.content, "enc:You've got this.");

    const [contents, config] = h.chat.mock.calls[0]!.arguments as [
      Array<{ role: string; parts: Array<{ text: string }> }>,
      { systemInstruction: string; maxOutputTokens: number },
    ];
    assert.deepEqual(contents.at(-1), {
      role: "user",
      parts: [{ text: "I feel an urge" }],
    });
    assert.equal(config.maxOutputTokens, MAX_OUTPUT_TOKENS);
    assert.match(
      config.systemInstruction,
      /Current date and time for the user: .*\(America\/New_York\)/,
    );
    assert.match(config.systemInstruction, /urge level is strong \(7\/10\)/);
  });

  it("keeps the user message when Gemini fails, and maps the error", async () => {
    const h = harness({
      chat: async () => {
        throw new GeminiError("unknown", "boom", {
          cause: new Error("network"),
        });
      },
    });
    await assert.rejects(
      runSponsorChat(h.ctx, { conversationId: CONVERSATION_ID, text: "hello" }),
      (error: unknown) => {
        assert.ok(error instanceof TRPCError);
        assert.equal(error.code, "INTERNAL_SERVER_ERROR");
        assert.equal(error.message, "Failed to generate response.");
        return true;
      },
    );
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
    assert.equal(h.setTitleIfNull.mock.callCount(), 0);
  });

  it("maps rate limits to TOO_MANY_REQUESTS (never UNAUTHORIZED)", async () => {
    const h = harness({
      chat: async () => {
        throw new GeminiError("rate_limited", "quota");
      },
    });
    await assert.rejects(
      runSponsorChat(h.ctx, { conversationId: CONVERSATION_ID, text: "hello" }),
      (error: unknown) => {
        assert.ok(error instanceof TRPCError);
        assert.equal(error.code, "TOO_MANY_REQUESTS");
        assert.equal(typeof error.message, "string");
        return true;
      },
    );
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
  });

  it("returns a supportive fallback through the success shape on a safety block", async () => {
    const h = harness({
      chat: async () => ({ status: "blocked", reason: "SAFETY" }),
    });
    const result = await runSponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      text: "something",
    });
    assert.equal(result.response, SAFETY_FALLBACK_REPLY);
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER", "MODEL"],
    );
    await flush();
    // no title from a blocked turn
    assert.ok(!h.events.includes("gemini:title"));
  });

  it("does not persist a truncated reply", async () => {
    const h = harness({
      chat: async () => ({ status: "truncated", text: "half a sent" }),
    });
    await assert.rejects(
      runSponsorChat(h.ctx, { conversationId: CONVERSATION_ID, text: "hello" }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR",
    );
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
  });

  it("throws NotFound and persists nothing when the conversation is missing", async () => {
    const h = harness({
      chat: async () => ({ status: "ok", text: "x" }),
      conversationExists: false,
    });
    await assert.rejects(
      runSponsorChat(h.ctx, { conversationId: CONVERSATION_ID, text: "hello" }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "NOT_FOUND",
    );
    assert.equal(h.addMessage.mock.callCount(), 0);
  });

  it("throws UNAUTHORIZED only when there is no user", async () => {
    const h = harness({ chat: async () => ({ status: "ok", text: "x" }) });
    const ctx = { ...h.ctx, auth: { user: null } } as unknown as Ctx;
    await assert.rejects(
      runSponsorChat(ctx, { conversationId: CONVERSATION_ID, text: "hello" }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "UNAUTHORIZED",
    );
  });

  it("generates a title only after a successful reply, only when untitled", async () => {
    const untitled = harness({
      chat: async () => ({ status: "ok", text: "reply" }),
      title: null,
    });
    await runSponsorChat(untitled.ctx, {
      conversationId: CONVERSATION_ID,
      text: "first",
    });
    await flush();
    assert.deepEqual(untitled.events, [
      "load",
      "persist:USER",
      "gemini:chat",
      "persist:MODEL",
      "gemini:title",
      "title:set",
    ]);

    const titled = harness({
      chat: async () => ({ status: "ok", text: "reply" }),
      title: "Existing",
    });
    await runSponsorChat(titled.ctx, {
      conversationId: CONVERSATION_ID,
      text: "again",
    });
    await flush();
    assert.ok(!titled.events.includes("gemini:title"));
  });

  it("does not let a title-generation failure become an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const h = harness({
        chat: async () => ({ status: "ok", text: "reply" }),
        titleChat: async () => {
          throw new GeminiError("unknown", "title failed");
        },
      });
      const result = await runSponsorChat(h.ctx, {
        conversationId: CONVERSATION_ID,
        text: "first",
      });
      assert.equal(result.response, "reply");
      await flush();
      await flush();
      assert.equal(unhandled.length, 0);
      assert.ok(h.loggerMock.error.mock.callCount() >= 1);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("merges an orphaned user message from a failed turn into the next turn's history", async () => {
    const h = harness({
      chat: async () => ({ status: "ok", text: "reply" }),
      existing: [
        { id: "a", role: "USER", content: "enc:hi", createdAt: new Date(1) },
        {
          id: "b",
          role: "MODEL",
          content: "enc:hello",
          createdAt: new Date(2),
        },
        {
          id: "c",
          role: "USER",
          content: "enc:lost one",
          createdAt: new Date(3),
        },
      ],
    });
    await runSponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      text: "retry",
    });
    const contents = h.chat.mock.calls[0]!.arguments[0] as Array<{
      role: string;
      parts: Array<{ text: string }>;
    }>;
    assert.deepEqual(
      contents.map((c) => `${c.role}:${c.parts[0]!.text}`),
      ["user:hi", "model:hello", "user:lost one\n\nretry"],
    );
  });

  it("serializes concurrent turns on the same conversation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const h = harness({
      chat: async () => {
        calls++;
        if (calls === 1) await gate;
        return { status: "ok", text: `reply${calls}` };
      },
      title: "t",
    });
    const first = runSponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      text: "one",
    });
    const second = runSponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      text: "two",
    });
    await flush();
    release();
    await Promise.all([first, second]);
    assert.deepEqual(h.events, [
      "load",
      "persist:USER",
      "gemini:chat",
      "persist:MODEL",
      "load",
      "persist:USER",
      "gemini:chat",
      "persist:MODEL",
    ]);
  });
});
