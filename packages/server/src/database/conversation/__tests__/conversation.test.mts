import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import type { DBClient } from "../../../util/database.mjs";
import { getOrCreate } from "../getOrCreate.mjs";
import { addMessage } from "../addMessage.mjs";
import { getMessagesPage } from "../getMessagesPage.mjs";
import { listPage } from "../listPage.mjs";
import { setTitleIfNull } from "../setTitleIfNull.mjs";
import { get } from "../get.mjs";

function txClient(tx: Record<string, unknown>, events: string[] = []) {
  return {
    $transaction: mock.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      events.push("tx:begin");
      const result = await fn(tx);
      events.push("tx:end");
      return result;
    }),
  } as unknown as DBClient;
}

describe("getOrCreate", () => {
  it("takes a per-user advisory lock inside the transaction before find-then-create", async () => {
    const events: string[] = [];
    const tx = {
      $executeRaw: mock.fn(
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          events.push(`lock:${strings.join("?")}:${values.join(",")}`);
          return 1;
        },
      ),
      conversation: {
        findFirst: mock.fn(async () => {
          events.push("find");
          return null;
        }),
        create: mock.fn(async () => {
          events.push("create");
          return { id: "new" };
        }),
      },
    };
    const { logger } = mockLogger();
    const result = await getOrCreate(logger, txClient(tx, events), "user-1");
    assert.deepEqual(result, { id: "new" });
    assert.equal(events[0], "tx:begin");
    assert.match(
      events[1]!,
      /^lock:SELECT pg_advisory_xact_lock\(hashtext\(\?\)\):conversation:getOrCreate:user-1$/,
    );
    assert.deepEqual(events.slice(2), ["find", "create", "tx:end"]);
  });
});

describe("addMessage", () => {
  it("creates the message and touches updatedAt in one transaction", async () => {
    const events: string[] = [];
    const tx = {
      conversation: {
        findFirst: mock.fn(async () => ({ id: "c" })),
        update: mock.fn(async () => {
          events.push("touch");
        }),
      },
      conversationMessage: {
        create: mock.fn(async () => {
          events.push("create");
          return { id: "m" };
        }),
      },
    };
    const { logger } = mockLogger();
    const result = await addMessage(
      logger,
      txClient(tx, events),
      "c",
      "u",
      "USER",
      "enc",
    );
    assert.deepEqual(result, { id: "m" });
    assert.deepEqual(events, ["tx:begin", "create", "touch", "tx:end"]);
  });

  it("returns null (nothing committed) when the touch fails", async () => {
    const client = {
      $transaction: mock.fn(async () => {
        throw new Error("update failed");
      }),
    } as unknown as DBClient;
    const { logger } = mockLogger();
    assert.equal(
      await addMessage(logger, client, "c", "u", "USER", "enc"),
      null,
    );
  });
});

describe("message ordering", () => {
  it("orders by createdAt then id", async () => {
    const findFirst = mock.fn(async () => ({ id: "c", messages: [] }));
    const { logger } = mockLogger();
    await get(
      logger,
      { conversation: { findFirst } } as unknown as DBClient,
      "c",
      "u",
    );
    const args = (findFirst.mock.calls[0]!.arguments as unknown[])[0] as {
      include: { messages: { orderBy: unknown } };
    };
    assert.deepEqual(args.include.messages.orderBy, [
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });
});

describe("getMessagesPage", () => {
  const conversation = { id: "c", title: null };

  it("returns the newest page in ascending order with nextCursor when more exist", async () => {
    const findMany = mock.fn(async () => [
      { id: "m5" },
      { id: "m4" },
      { id: "m3" },
    ]);
    const client = {
      conversation: { findFirst: async () => conversation },
      conversationMessage: { findMany, findFirst: mock.fn() },
    } as unknown as DBClient;
    const { logger } = mockLogger();
    const page = await getMessagesPage(logger, client, "c", "u", { limit: 2 });
    assert.deepEqual(page, {
      conversation,
      messages: [{ id: "m4" }, { id: "m5" }],
      nextCursor: "m4",
    });
    const args = (findMany.mock.calls[0]!.arguments as unknown[])[0] as {
      take: number;
      orderBy: unknown;
    };
    assert.equal(args.take, 3);
    assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("uses keyset conditions after a cursor and null nextCursor on the last page", async () => {
    const cursorRow = { id: "m4", createdAt: new Date(4) };
    const findMany = mock.fn(async () => [{ id: "m3" }]);
    const client = {
      conversation: { findFirst: async () => conversation },
      conversationMessage: { findMany, findFirst: async () => cursorRow },
    } as unknown as DBClient;
    const { logger } = mockLogger();
    const page = await getMessagesPage(logger, client, "c", "u", {
      cursor: "m4",
      limit: 2,
    });
    assert.deepEqual(page?.nextCursor, null);
    const args = (findMany.mock.calls[0]!.arguments as unknown[])[0] as {
      where: unknown;
    };
    assert.deepEqual(args.where, {
      conversationId: "c",
      OR: [
        { createdAt: { lt: cursorRow.createdAt } },
        { createdAt: cursorRow.createdAt, id: { lt: "m4" } },
      ],
    });
  });

  it("returns an empty page for an unknown cursor, null for a missing conversation", async () => {
    const { logger } = mockLogger();
    const unknownCursor = {
      conversation: { findFirst: async () => conversation },
      conversationMessage: { findFirst: async () => null, findMany: mock.fn() },
    } as unknown as DBClient;
    assert.deepEqual(
      await getMessagesPage(logger, unknownCursor, "c", "u", {
        cursor: "zz",
        limit: 2,
      }),
      {
        conversation,
        messages: [],
        nextCursor: null,
      },
    );
    const missing = {
      conversation: { findFirst: async () => null },
    } as unknown as DBClient;
    assert.equal(
      await getMessagesPage(logger, missing, "c", "u", { limit: 2 }),
      null,
    );
  });
});

describe("listPage", () => {
  const row = (id: string, n: number) => ({ id, updatedAt: new Date(n) });

  it("pages most-recently-updated first with an opaque (updatedAt, id) cursor", async () => {
    const findMany = mock.fn(async () => [
      row("a", 30),
      row("b", 20),
      row("c", 10),
    ]);
    const client = { conversation: { findMany } } as unknown as DBClient;
    const { logger } = mockLogger();
    const first = await listPage(logger, client, "u", { limit: 2 });
    assert.deepEqual(
      first?.conversations.map((c) => c.id),
      ["a", "b"],
    );
    assert.ok(first?.nextCursor);

    // the next page is positioned by the cursor's own (updatedAt, id), so a
    // conversation updated in between does not reset or skip pages
    const second = mock.fn(async () => [row("c", 10)]);
    const client2 = {
      conversation: { findMany: second },
    } as unknown as DBClient;
    const next = await listPage(logger, client2, "u", {
      cursor: first!.nextCursor!,
      limit: 2,
    });
    assert.equal(next?.nextCursor, null);
    const args = (second.mock.calls[0]!.arguments as unknown[])[0] as {
      where: unknown;
    };
    assert.deepEqual(args.where, {
      userId: "u",
      OR: [
        { updatedAt: { lt: new Date(20) } },
        { updatedAt: new Date(20), id: { lt: "b" } },
      ],
    });
  });

  it("returns an empty page for an unreadable cursor", async () => {
    const findMany = mock.fn();
    const client = { conversation: { findMany } } as unknown as DBClient;
    const { logger } = mockLogger();
    assert.deepEqual(
      await listPage(logger, client, "u", { cursor: "garbage", limit: 2 }),
      {
        conversations: [],
        nextCursor: null,
      },
    );
    assert.equal(findMany.mock.callCount(), 0);
  });

  it("returns null on a database error instead of a fake end of list", async () => {
    const client = {
      conversation: {
        findMany: async () => {
          throw new Error("db down");
        },
      },
    } as unknown as DBClient;
    const { logger } = mockLogger();
    assert.equal(await listPage(logger, client, "u", { limit: 2 }), null);
  });
});

describe("setTitleIfNull", () => {
  it("only updates when the title is still null", async () => {
    const updateMany = mock.fn(async () => ({ count: 0 }));
    const { logger } = mockLogger();
    const wrote = await setTitleIfNull(
      logger,
      { conversation: { updateMany } } as unknown as DBClient,
      "c",
      "u",
      "Hope",
    );
    assert.equal(wrote, false);
    assert.deepEqual((updateMany.mock.calls[0]!.arguments as unknown[])[0], {
      where: { id: "c", userId: "u", OR: [{ title: null }, { title: "" }] },
      data: { title: "Hope" },
    });
  });
});
