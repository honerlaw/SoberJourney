import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { mockLogger } from "../../../../../../util/__mocks__/logger.mjs";
import {
  GeminiError,
  type ChatResult,
} from "../../../../../../datasource/gemini/chat.mjs";
import {
  runStreamSponsorChat,
  type SponsorChatStreamEvent,
} from "../runStreamSponsorChat.mjs";
import { MAX_OUTPUT_TOKENS } from "../runSponsorChat.mjs";
import {
  BLOCKED_FALLBACK_REPLY,
  OFF_TOPIC_REPLY,
  SAFETY_FALLBACK_REPLY,
} from "../utils/fallback.mjs";
import {
  CHAT_RATE_LIMITS,
  resetChatRateLimits,
} from "../../utils/chatRateLimit.mjs";
import {
  activeLockCount,
  withConversationLock,
} from "../../utils/conversationLock.mjs";

type Ctx = Parameters<typeof runStreamSponsorChat>[0];

const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

type Row = {
  id: string;
  role: "USER" | "MODEL";
  content: string;
  createdAt: Date;
};

type StreamConfig = {
  systemInstruction?: string;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
};

/** A fake Gemini stream: yields `deltas`, then runs `end` for the result. */
type FakeStream = (
  config: StreamConfig,
) => AsyncGenerator<string, ChatResult, undefined>;

function streamOf(
  deltas: string[],
  end: (config: StreamConfig) => Promise<ChatResult> | ChatResult = () => ({
    status: "ok",
    text: deltas.join("").trim(),
  }),
): FakeStream {
  return async function* (config) {
    for (const delta of deltas) yield delta;
    return await end(config);
  };
}

/** Rejects with an AbortError when the signal aborts (like the SDK). */
function untilAborted(config: StreamConfig): Promise<never> {
  return new Promise((_, reject) => {
    const signal = config.abortSignal!;
    const fail = () => reject(new DOMException("aborted", "AbortError"));
    if (signal.aborted) fail();
    signal.addEventListener("abort", fail, { once: true });
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function harness(options: {
  stream: FakeStream;
  conversationExists?: boolean;
  title?: string | null;
  beforePersistModel?: () => Promise<void>;
  noUser?: boolean;
  onLoad?: (call: number) => void;
}) {
  const events: string[] = [];
  const stored: Row[] = [];
  let nextId = 1;
  const { logger } = mockLogger();
  const streamConfigs: StreamConfig[] = [];

  const addMessage = mock.fn(
    async (_c: string, _u: string, role: "USER" | "MODEL", content: string) => {
      if (role === "MODEL") await options.beforePersistModel?.();
      events.push(`persist:${role}`);
      const row = { id: `m${nextId++}`, role, content, createdAt: new Date() };
      stored.push(row);
      return row;
    },
  );
  let loads = 0;
  const getMessagesPage = mock.fn(async () => {
    events.push("load");
    options.onLoad?.(++loads);
    if (options.conversationExists === false) return null;
    return {
      conversation: { id: CONVERSATION_ID, title: options.title ?? "Titled" },
      messages: [...stored],
      nextCursor: null,
    };
  });
  const chatStream = mock.fn((_contents: unknown, config: StreamConfig) => {
    events.push("gemini:stream");
    streamConfigs.push(config);
    return options.stream(config);
  });

  const ctx = {
    logger,
    auth: {
      user: options.noUser
        ? undefined
        : { id: "user-1", timezone: "America/New_York" },
    },
    datasource: {
      gemini: {
        chatStream,
        chat: mock.fn(async () => ({ status: "ok", text: "Title" })),
      },
    },
    database: {
      journey: { list: mock.fn(async () => []) },
      conversation: {
        getMessagesPage,
        getRecentCheckInEntries: mock.fn(async () => []),
        addMessage,
        setTitleIfNull: mock.fn(async () => true),
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

  return { ctx, events, stored, chatStream, streamConfigs, getMessagesPage };
}

const input = { conversationId: CONVERSATION_ID, text: "I feel an urge" };

beforeEach(() => resetChatRateLimits());
const flush = () => new Promise((r) => setTimeout(r, 5));

async function collect(
  generator: AsyncGenerator<SponsorChatStreamEvent, void, undefined>,
): Promise<{ events: SponsorChatStreamEvent[]; error?: unknown }> {
  const events: SponsorChatStreamEvent[] = [];
  try {
    for await (const event of generator) events.push(event);
    return { events };
  } catch (error) {
    return { events, error };
  }
}

async function waitForLockRelease() {
  for (let i = 0; i < 50 && activeLockCount() > 0; i++) await flush();
  assert.equal(activeLockCount(), 0, "conversation lock released");
}

describe("runStreamSponsorChat", () => {
  it("streams saved → deltas → done, persisting the user message before generating", async () => {
    const h = harness({ stream: streamOf(["You've ", "got this."]) });
    const { events, error } = await collect(runStreamSponsorChat(h.ctx, input));

    assert.equal(error, undefined);
    assert.deepEqual(events, [
      { type: "saved", userMessageId: "m1" },
      { type: "delta", text: "You've " },
      { type: "delta", text: "got this." },
      {
        type: "done",
        response: "You've got this.",
        userMessageId: "m1",
        modelMessageId: "m2",
      },
    ]);
    assert.deepEqual(h.events, [
      "load",
      "persist:USER",
      "load",
      "gemini:stream",
      "persist:MODEL",
    ]);
    assert.deepEqual(
      h.stored.map((r) => r.content),
      ["enc:I feel an urge", "enc:You've got this."],
    );
    const [contents] = h.chatStream.mock.calls[0]!.arguments as unknown as [
      Array<{ role: string; parts: Array<{ text: string }> }>,
    ];
    assert.deepEqual(contents.at(-1), {
      role: "user",
      parts: [{ text: "I feel an urge" }],
    });
    assert.equal(h.streamConfigs[0]!.maxOutputTokens, MAX_OUTPUT_TOKENS);
    assert.match(h.streamConfigs[0]!.systemInstruction!, /Crisis resources:/);
    await waitForLockRelease();
  });

  it("keeps the user message when Gemini fails mid-stream and surfaces the mapped error", async () => {
    const h = harness({
      stream: streamOf(["par"], () => {
        throw new GeminiError("unknown", "boom");
      }),
    });
    const { events, error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.deepEqual(events, [
      { type: "saved", userMessageId: "m1" },
      { type: "delta", text: "par" },
    ]);
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, "INTERNAL_SERVER_ERROR");
    assert.equal(error.message, "Failed to generate response.");
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
    await waitForLockRelease();
  });

  it("maps rate limits to TOO_MANY_REQUESTS (never UNAUTHORIZED)", async () => {
    const h = harness({
      stream: streamOf([], () => {
        throw new GeminiError("rate_limited", "quota");
      }),
    });
    const { error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, "TOO_MANY_REQUESTS");
  });

  it("replaces a safety-blocked reply with the fallback, persisted once", async () => {
    for (const [reason, fallback] of [
      ["SAFETY", SAFETY_FALLBACK_REPLY],
      ["PROHIBITED_CONTENT", SAFETY_FALLBACK_REPLY],
      ["RECITATION", BLOCKED_FALLBACK_REPLY],
    ] as const) {
      const h = harness({
        stream: streamOf(["unsafe partial"], () => ({
          status: "blocked",
          reason,
        })),
      });
      const { events, error } = await collect(
        runStreamSponsorChat(h.ctx, input),
      );
      assert.equal(error, undefined);
      assert.deepEqual(events.at(-1), {
        type: "done",
        response: fallback,
        userMessageId: "m1",
        modelMessageId: "m2",
      });
      assert.deepEqual(
        h.stored.map((r) => r.content),
        ["enc:I feel an urge", `enc:${fallback}`],
      );
    }
  });

  it("never stores a truncated reply", async () => {
    const h = harness({
      stream: streamOf(["cut"], () => ({ status: "truncated", text: "cut" })),
    });
    const { error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, "INTERNAL_SERVER_ERROR");
    assert.match(error.message, /cut off/);
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
  });

  it("returns NOT_FOUND for a missing conversation and persists nothing", async () => {
    const h = harness({
      stream: streamOf(["x"]),
      conversationExists: false,
    });
    const { events, error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.deepEqual(events, []);
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(h.stored.length, 0);
  });

  it("rejects a request without a user as UNAUTHORIZED", async () => {
    const h = harness({ stream: streamOf(["x"]), noUser: true });
    const { error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, "UNAUTHORIZED");
  });

  it("on abort mid-stream cancels Gemini, stores no reply, ends the stream and releases the lock", async () => {
    const h = harness({ stream: streamOf(["first "], untilAborted) });
    const abort = new AbortController();
    const generator = runStreamSponsorChat(h.ctx, input, abort.signal);

    assert.equal((await generator.next()).value?.type, "saved");
    assert.deepEqual((await generator.next()).value, {
      type: "delta",
      text: "first ",
    });
    // the consumer is now waiting on the channel; the abort must wake it
    const waiting = generator.next();
    abort.abort();
    assert.deepEqual(await waiting, { done: true, value: undefined });

    assert.equal(h.streamConfigs[0]!.abortSignal!.aborted, true);
    await waitForLockRelease();
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );

    // a following turn on the same conversation runs normally
    const next = harness({ stream: streamOf(["ok"]) });
    const { error } = await collect(runStreamSponsorChat(next.ctx, input));
    assert.equal(error, undefined);
  });

  it("aborts generation when the consumer stops early", async () => {
    const h = harness({ stream: streamOf(["first "], untilAborted) });
    const generator = runStreamSponsorChat(h.ctx, input);
    await generator.next(); // saved
    await generator.next(); // delta
    await generator.return(undefined);
    assert.equal(h.streamConfigs[0]!.abortSignal!.aborted, true);
    await waitForLockRelease();
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
  });

  it("does nothing when aborted while queued behind another turn", async () => {
    const h = harness({ stream: streamOf(["x"]) });
    const gate = deferred();
    const holder = withConversationLock(CONVERSATION_ID, () => gate.promise);

    const abort = new AbortController();
    const generator = runStreamSponsorChat(h.ctx, input, abort.signal);
    const waiting = generator.next();
    await flush();
    abort.abort();
    assert.deepEqual(await waiting, { done: true, value: undefined });

    gate.resolve();
    await holder;
    await waitForLockRelease();
    assert.equal(h.getMessagesPage.mock.callCount(), 0);
    assert.equal(h.chatStream.mock.callCount(), 0);
    assert.equal(h.stored.length, 0);
  });

  it("still persists a reply exactly once when the abort lands after generation finished", async () => {
    const persistGate = deferred();
    const reachedPersist = deferred();
    const h = harness({
      stream: streamOf(["done text"]),
      beforePersistModel: async () => {
        reachedPersist.resolve();
        await persistGate.promise;
      },
    });
    const abort = new AbortController();
    const generator = runStreamSponsorChat(h.ctx, input, abort.signal);
    await generator.next(); // saved
    await generator.next(); // delta
    const waiting = generator.next();
    await reachedPersist.promise;
    abort.abort();
    assert.deepEqual(await waiting, { done: true, value: undefined });

    persistGate.resolve();
    await waitForLockRelease();
    assert.deepEqual(
      h.stored.map((r) => r.content),
      ["enc:I feel an urge", "enc:done text"],
    );
  });

  it("persists nothing when aborted after the ownership check, before saving", async () => {
    const abort = new AbortController();
    const h = harness({
      stream: streamOf(["x"]),
      onLoad: (call) => {
        if (call === 1) abort.abort();
      },
    });
    const { events, error } = await collect(
      runStreamSponsorChat(h.ctx, input, abort.signal),
    );
    assert.deepEqual(events, []);
    assert.equal(error, undefined);
    await waitForLockRelease();
    assert.equal(h.stored.length, 0);
    assert.equal(h.chatStream.mock.callCount(), 0);
  });

  it("emits saved right after persisting, before an error reading history", async () => {
    const h = harness({
      stream: streamOf(["x"]),
      onLoad: (call) => {
        if (call === 2) throw new Error("db down");
      },
    });
    const { events, error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.deepEqual(events, [{ type: "saved", userMessageId: "m1" }]);
    assert.ok(error instanceof Error);
    assert.deepEqual(
      h.stored.map((r) => r.role),
      ["USER"],
    );
  });
});

describe("runStreamSponsorChat abuse hardening", () => {
  beforeEach(() => resetChatRateLimits());

  function deltasOf(events: SponsorChatStreamEvent[]): string[] {
    return events.flatMap((e) => (e.type === "delta" ? [e.text] : []));
  }

  it("stops forwarding deltas once the reply contains a fence, and done carries the guarded reply", async () => {
    const h = harness({
      stream: streamOf([
        "Here is the script:\n",
        "```python\n",
        'print("hi")\n',
        "```",
      ]),
    });
    const { events, error } = await collect(runStreamSponsorChat(h.ctx, input));

    assert.equal(error, undefined);
    assert.deepEqual(deltasOf(events), ["Here is the script:\n"]);
    assert.deepEqual(events.at(-1), {
      type: "done",
      response: OFF_TOPIC_REPLY,
      userMessageId: "m1",
      modelMessageId: "m2",
    });
    assert.deepEqual(
      h.stored.map((r) => r.content),
      ["enc:I feel an urge", `enc:${OFF_TOPIC_REPLY}`],
    );
    await waitForLockRelease();
  });

  it("catches a fence split across chunks", async () => {
    const h = harness({
      stream: streamOf(["Sure:\n``", "`python\nprint(1)", "\n```"]),
    });
    const { events } = await collect(runStreamSponsorChat(h.ctx, input));

    assert.deepEqual(deltasOf(events), ["Sure:\n``"]);
    const done = events.at(-1);
    assert.ok(done?.type === "done");
    assert.equal(done.response, OFF_TOPIC_REPLY);
  });

  it("keeps crisis prose in done when a fenced reply carries crisis resources", async () => {
    const h = harness({
      stream: streamOf([
        "Please call or text 988 right now. ",
        "I'm here.\n```\nprint(1)\n```",
      ]),
    });
    const { events } = await collect(runStreamSponsorChat(h.ctx, input));
    const done = events.at(-1);
    assert.ok(done?.type === "done");
    assert.equal(done.response, "Please call or text 988 right now. I'm here.");
    assert.equal(h.stored.filter((r) => r.role === "MODEL").length, 1);
  });

  it("rejects over-limit turns with TOO_MANY_REQUESTS before any event", async () => {
    const perMinute = CHAT_RATE_LIMITS[0].max;
    for (let i = 0; i < perMinute; i++) {
      const h = harness({ stream: streamOf(["Hi"]) });
      const { error } = await collect(runStreamSponsorChat(h.ctx, input));
      assert.equal(error, undefined);
    }

    const h = harness({ stream: streamOf(["Hi"]) });
    const { events, error } = await collect(runStreamSponsorChat(h.ctx, input));
    assert.deepEqual(events, []);
    assert.ok(error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS");
    assert.deepEqual(h.stored, []);
    assert.equal(h.chatStream.mock.callCount(), 0);
  });
});
