import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { mockLogger } from "../../../../../../util/__mocks__/logger.mjs";
import {
  LlmError,
  type ChatResult,
} from "../../../../../../datasource/openrouter/chat.mjs";
import {
  runRetrySponsorChat,
  NOT_RETRYABLE_MESSAGE,
} from "../runRetrySponsorChat.mjs";
import { runSponsorChat } from "../runSponsorChat.mjs";
import { OFF_TOPIC_REPLY, SAFETY_FALLBACK_REPLY } from "../utils/fallback.mjs";
import {
  CHAT_RATE_LIMITS,
  consumeChatRateLimit,
  resetChatRateLimits,
} from "../../utils/chatRateLimit.mjs";
import { retrySponsorChatInput } from "../../retrySponsorChat.mjs";

type Ctx = Parameters<typeof runRetrySponsorChat>[0];

const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

type Row = {
  id: string;
  role: "USER" | "MODEL";
  content: string;
  createdAt: Date;
};

const row = (id: string, role: Row["role"], text: string): Row => ({
  id,
  role,
  content: `enc:${text}`,
  createdAt: new Date(),
});

function harness(options: {
  existing: Row[];
  chat?: () => Promise<ChatResult>;
  title?: string | null;
  conversationExists?: boolean;
}) {
  const events: string[] = [];
  const stored: Row[] = [...options.existing];
  let nextId = 100;
  const { logger } = mockLogger();
  const histories: unknown[] = [];

  const chat = mock.fn(
    async (request: { system?: string; messages?: unknown }) => {
      if (request.system?.startsWith("You are a title generator")) {
        events.push("llm:title");
        return { status: "ok", text: "Hope" } as ChatResult;
      }
      events.push("llm:chat");
      histories.push(request.messages);
      return (
        options.chat ??
        (async () => ({ status: "ok", text: "Here for you." }) as ChatResult)
      )();
    },
  );

  const ctx = {
    logger,
    auth: { user: { id: "user-1", timezone: "America/New_York" } },
    datasource: { openrouter: { chat } },
    database: {
      journey: { list: mock.fn(async () => []) },
      conversation: {
        getMessagesPage: mock.fn(async () => {
          events.push("load");
          if (options.conversationExists === false) return null;
          return {
            conversation: { id: CONVERSATION_ID, title: options.title ?? null },
            messages: [...stored],
            nextCursor: null,
          };
        }),
        getRecentCheckInEntries: mock.fn(async () => []),
        addMessage: mock.fn(
          async (
            _c: string,
            _u: string,
            role: "USER" | "MODEL",
            content: string,
          ) => {
            events.push(`persist:${role}`);
            const r = {
              id: `m${nextId++}`,
              role,
              content,
              createdAt: new Date(),
            };
            stored.push(r);
            return r;
          },
        ),
        setTitleIfNull: mock.fn(async () => {
          events.push("title:set");
          return true;
        }),
      },
    },
    service: {
      encryption: {
        DEKIdentifier: { CONVERSATION: "conversation" },
        encrypt: async (_c: unknown, _i: unknown, text: string) =>
          `enc:${text}`,
        decrypt: async (_c: unknown, _i: unknown, text: string) =>
          text.replace(/^enc:/, ""),
      },
    },
  } as unknown as Ctx;

  return { ctx, events, stored, histories };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const isConflict = (error: unknown) =>
  error instanceof TRPCError &&
  error.code === "CONFLICT" &&
  error.message === NOT_RETRYABLE_MESSAGE;

beforeEach(() => resetChatRateLimits());

describe("runRetrySponsorChat", () => {
  it("answers the newest unanswered user message without saving it again", async () => {
    const h = harness({
      existing: [
        row("m1", "USER", "hello"),
        row("m2", "MODEL", "hi there"),
        row("m3", "USER", "I want a drink"),
      ],
      title: "Titled",
    });

    const result = await runRetrySponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      messageId: "m3",
    });

    assert.deepEqual(result, {
      response: "Here for you.",
      userMessageId: "m3",
      modelMessageId: "m100",
    });
    assert.deepEqual(h.events, ["load", "llm:chat", "persist:MODEL"]);
    assert.equal(h.stored.filter((r) => r.role === "USER").length, 2);
    // the retried text goes last, exactly once
    assert.deepEqual(h.histories[0], [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
      { role: "user", content: "I want a drink" },
    ]);
  });

  it("generates a title when the conversation is still untitled", async () => {
    const h = harness({ existing: [row("m1", "USER", "first")] });
    await runRetrySponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      messageId: "m1",
    });
    await flush();
    assert.ok(h.events.includes("title:set"));
  });

  it("rejects with CONFLICT when the message already has a reply", async () => {
    const h = harness({
      existing: [row("m1", "USER", "hello"), row("m2", "MODEL", "hi")],
    });
    await assert.rejects(
      runRetrySponsorChat(h.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      isConflict,
    );
    assert.deepEqual(h.events, ["load"]);
  });

  it("rejects with CONFLICT for a model message, an older user message or an unknown id", async () => {
    const h = harness({
      existing: [
        row("m1", "USER", "a"),
        row("m2", "USER", "b"),
        row("m3", "MODEL", "c"),
      ],
    });
    for (const messageId of ["m3", "m1", "zzz"]) {
      await assert.rejects(
        runRetrySponsorChat(h.ctx, {
          conversationId: CONVERSATION_ID,
          messageId,
        }),
        isConflict,
      );
    }
    const h2 = harness({
      existing: [row("m1", "USER", "a"), row("m2", "USER", "b")],
    });
    await assert.rejects(
      runRetrySponsorChat(h2.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      isConflict,
    );
    const h3 = harness({ existing: [] });
    await assert.rejects(
      runRetrySponsorChat(h3.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      isConflict,
    );
  });

  it("throws NOT_FOUND for a missing conversation", async () => {
    const h = harness({ existing: [], conversationExists: false });
    await assert.rejects(
      runRetrySponsorChat(h.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "NOT_FOUND",
    );
  });

  it("saves nothing when generation fails again, so the message stays retryable", async () => {
    const h = harness({
      existing: [row("m1", "USER", "hello")],
      chat: async () => {
        throw new LlmError("unavailable", "down");
      },
    });
    await assert.rejects(
      runRetrySponsorChat(h.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR",
    );
    assert.equal(h.stored.length, 1);
  });

  it("stores the supportive fallback when the retried generation is safety-blocked", async () => {
    const h = harness({
      existing: [row("m1", "USER", "hello")],
      chat: async () => ({ status: "blocked", reason: "SAFETY" }) as ChatResult,
    });
    const result = await runRetrySponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      messageId: "m1",
    });
    assert.equal(result.response, SAFETY_FALLBACK_REPLY);
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER", "MODEL"],
    );
    await flush();
    assert.ok(!h.events.includes("llm:title"));
  });

  it("stores nothing for a truncated reply, so the message stays retryable", async () => {
    const h = harness({
      existing: [row("m1", "USER", "hello")],
      chat: async () => ({ status: "truncated", text: "par" }) as ChatResult,
    });
    await assert.rejects(
      runRetrySponsorChat(h.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR",
    );
    assert.equal(h.stored.length, 1);
  });

  it("throws UNAUTHORIZED only when there is no user", async () => {
    const h = harness({ existing: [] });
    const ctx = { ...h.ctx, auth: { user: null } } as unknown as Ctx;
    await assert.rejects(
      runRetrySponsorChat(ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "UNAUTHORIZED",
    );
  });

  it("queues behind an in-flight sponsorChat turn and then sees its reply (CONFLICT)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const h = harness({
      existing: [],
      chat: async () => {
        await gate;
        return { status: "ok", text: "reply" };
      },
      title: "T",
    });
    const turn = runSponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      text: "hello",
    });
    await flush();
    const userId = h.stored[0]!.id;
    const retry = runRetrySponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      messageId: userId,
    });
    release();
    await turn;
    await assert.rejects(retry, isConflict);
    assert.equal(h.stored.filter((r) => r.role === "MODEL").length, 1);
  });

  it("validates input: a uuid conversation id and a non-empty message id", () => {
    assert.equal(
      retrySponsorChatInput.safeParse({
        conversationId: CONVERSATION_ID,
        messageId: "",
      }).success,
      false,
    );
    assert.equal(
      retrySponsorChatInput.safeParse({
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }).success,
      true,
    );
  });
});

describe("runRetrySponsorChat abuse hardening", () => {
  beforeEach(() => resetChatRateLimits());

  it("stores the off-topic reply when the retried reply contains fenced code", async () => {
    const h = harness({
      existing: [row("m1", "USER", "write me a script")],
      title: "Titled",
      chat: async () => ({ status: "ok", text: "```sh\necho hi\n```" }),
    });
    const result = await runRetrySponsorChat(h.ctx, {
      conversationId: CONVERSATION_ID,
      messageId: "m1",
    });
    assert.equal(result.response, OFF_TOPIC_REPLY);
  });

  it("shares the per-user limit and rejects before generating", async () => {
    for (let i = 0; i < CHAT_RATE_LIMITS[0].max; i++) {
      consumeChatRateLimit("user-1");
    }
    const h = harness({ existing: [row("m1", "USER", "hello")] });
    await assert.rejects(
      runRetrySponsorChat(h.ctx, {
        conversationId: CONVERSATION_ID,
        messageId: "m1",
      }),
      (error: unknown) =>
        error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS",
    );
    assert.deepEqual(h.events, []);
  });
});
