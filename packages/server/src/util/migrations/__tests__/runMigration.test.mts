import { afterEach, describe, it, mock, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mockConfig } from "../../__mocks__/config.mjs";
import { mockLogger } from "../../__mocks__/logger.mjs";
import type { Context } from "../../../context.mjs";

describe("Data migrations", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function createMigrationCtx(options: { markerExists?: boolean } = {}) {
    const { logger, mocked: loggerMock } = mockLogger();
    const order: string[] = [];
    const tx = {
      migration: {
        create: mock.fn(async (args: { data: { name: string } }) => {
          order.push(`marker:${args.data.name}`);
        }),
      },
    };
    const $transaction = mock.fn(
      async (fn: (t: typeof tx) => Promise<unknown>, _opts?: unknown) => {
        order.push("begin");
        await fn(tx);
        order.push("commit");
      },
    );
    const findUnique = mock.fn(async () =>
      options.markerExists ? { id: "1", name: "m" } : null,
    );

    const ctx = {
      logger,
      database: {
        client: { migration: { findUnique }, $transaction },
      },
    } as unknown as Context;

    return { ctx, tx, order, $transaction, findUnique, loggerMock };
  }

  async function load() {
    const { runMigration } = await import("../runMigration.mjs");
    return runMigration;
  }

  it("should skip when the marker already exists", async () => {
    const runMigration = await load();
    const { ctx, $transaction } = createMigrationCtx({ markerExists: true });
    const prepare = mock.fn(async () => []);

    assert.strictEqual(await runMigration(ctx, "m", prepare), false);
    assert.strictEqual(prepare.mock.callCount(), 0);
    assert.strictEqual($transaction.mock.callCount(), 0);
  });

  it("should prepare outside the transaction and insert the marker first inside it", async () => {
    const runMigration = await load();
    const { ctx, order, $transaction } = createMigrationCtx();

    const applied = await runMigration(ctx, "m", async () => {
      order.push("prepare");
      return [
        async () => {
          order.push("write:1");
        },
        async () => {
          order.push("write:2");
        },
      ];
    });

    assert.strictEqual(applied, true);
    assert.deepStrictEqual(order, [
      "prepare",
      "begin",
      "marker:m",
      "write:1",
      "write:2",
      "commit",
    ]);
    const opts = $transaction.mock.calls[0]?.arguments[1] as {
      timeout: number;
      maxWait: number;
    };
    assert.ok(opts.timeout > 5000, "raises prisma's 5s default timeout");
    assert.ok(opts.maxWait > 0);
  });

  it("should not record the migration when prepare aborts", async () => {
    const runMigration = await load();
    const { ctx, $transaction } = createMigrationCtx();

    assert.strictEqual(await runMigration(ctx, "m", async () => false), false);
    assert.strictEqual($transaction.mock.callCount(), 0);
  });

  it("should resolve (never reject) when prepare throws", async () => {
    const runMigration = await load();
    const { ctx, $transaction, loggerMock } = createMigrationCtx();

    const applied = await runMigration(ctx, "m", async () => {
      throw new Error("boom");
    });

    assert.strictEqual(applied, false);
    assert.strictEqual($transaction.mock.callCount(), 0);
    assert.strictEqual(loggerMock.error.mock.callCount(), 1);
  });

  it("should resolve when a write fails (the transaction rolls back)", async () => {
    const runMigration = await load();
    const { ctx, order, loggerMock } = createMigrationCtx();

    const applied = await runMigration(ctx, "m", async () => [
      async () => {
        throw new Error("write failed");
      },
    ]);

    assert.strictEqual(applied, false);
    assert.ok(!order.includes("commit"));
    assert.strictEqual(loggerMock.error.mock.callCount(), 1);
  });

  it("should resolve quietly when another instance won the marker race", async () => {
    const runMigration = await load();
    const { ctx, tx, loggerMock } = createMigrationCtx();
    tx.migration.create.mock.mockImplementation(async () => {
      throw Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
    });
    const write = mock.fn(async () => undefined);

    const applied = await runMigration(ctx, "m", async () => [write]);

    assert.strictEqual(applied, false);
    assert.strictEqual(write.mock.callCount(), 0);
    assert.strictEqual(loggerMock.error.mock.callCount(), 0);
    assert.strictEqual(loggerMock.info.mock.callCount(), 1);
  });

  describe("encryption migrations", () => {
    async function encryptionHarness(context: TestContext) {
      mockConfig(context, async () => "test");
      const encryption = await import("../../../service/encryption/index.mjs");
      const { prepareEncryptJournalEntries, prepareEncryptConversations } =
        await import("../prepare.mjs");

      const storedKeys = new Map<string, string>();
      const keyLookups: string[] = [];

      function userCtx(user: { id: string }) {
        return {
          auth: { user },
          service: { encryption },
          database: {
            client: {
              userKey: {
                findUnique: async (args: { where: { userId: string } }) => {
                  keyLookups.push(args.where.userId);
                  const key = storedKeys.get(args.where.userId);
                  return key === undefined ? null : { key };
                },
              },
            },
            user: {
              key: {
                upsert: async (userId: string, key: string) => {
                  if (!storedKeys.has(userId)) {
                    storedKeys.set(userId, key);
                  }
                  return { userId, key: storedKeys.get(userId) };
                },
              },
            },
          },
        } as unknown as Context;
      }

      return {
        encryption,
        prepareEncryptJournalEntries,
        prepareEncryptConversations,
        keyLookups,
        userCtx,
      };
    }

    function rootCtx(
      users: unknown[],
      clone: (user: { id: string }) => Context,
    ) {
      return {
        auth: { user: null },
        clone: mock.fn(async (user: { id: string }) => clone(user)),
        database: {
          client: { user: { findMany: mock.fn(async () => users) } },
        },
      } as unknown as Context & { clone: ReturnType<typeof mock.fn> };
    }

    it("should encrypt journal entries resolving the DEK once per user", async (context) => {
      const { encryption, prepareEncryptJournalEntries, keyLookups, userCtx } =
        await encryptionHarness(context);
      const users = [
        {
          id: "a",
          journalEntries: [1, 2, 3].map((i) => ({
            id: `a${i}`,
            content: `a entry ${i}`,
          })),
        },
        { id: "empty", journalEntries: [] },
        {
          id: "b",
          journalEntries: [1, 2].map((i) => ({
            id: `b${i}`,
            content: `b entry ${i}`,
          })),
        },
      ];
      const ctx = rootCtx(users, userCtx);

      const writes = await prepareEncryptJournalEntries(ctx);

      assert.strictEqual(writes.length, 5);
      assert.strictEqual(ctx.clone.mock.callCount(), 2);
      assert.deepStrictEqual(keyLookups, ["a", "b"]);

      const updates: { where: { id: string }; data: { content: string } }[] =
        [];
      const tx = {
        journalEntry: {
          update: async (args: (typeof updates)[number]) => {
            updates.push(args);
          },
        },
      };
      for (const write of writes) {
        await write(tx as never);
      }

      for (const update of updates) {
        const owner = update.where.id.startsWith("a") ? "a" : "b";
        const plain = await encryption.decrypt(
          userCtx({ id: owner }),
          encryption.DEKIdentifier.JOURNAL,
          update.data.content,
        );
        assert.strictEqual(plain, `${owner} entry ${update.where.id.slice(1)}`);
      }
    });

    it("should encrypt conversation messages resolving the DEK once per user", async (context) => {
      const { encryption, prepareEncryptConversations, keyLookups, userCtx } =
        await encryptionHarness(context);
      const users = [
        {
          id: "a",
          conversations: [
            { messages: [{ id: "m1", content: "hi" }] },
            {
              messages: [
                { id: "m2", content: "hello" },
                { id: "m3", content: "hey" },
              ],
            },
          ],
        },
        { id: "empty", conversations: [] },
      ];
      const ctx = rootCtx(users, userCtx);

      const writes = await prepareEncryptConversations(ctx);

      assert.strictEqual(writes.length, 3);
      assert.deepStrictEqual(keyLookups, ["a"]);

      const contents = new Map<string, string>();
      const tx = {
        conversationMessage: {
          update: async (args: {
            where: { id: string };
            data: { content: string };
          }) => {
            contents.set(args.where.id, args.data.content);
          },
        },
      };
      for (const write of writes) {
        await write(tx as never);
      }

      const reader = userCtx({ id: "a" });
      assert.strictEqual(
        await encryption.decrypt(
          reader,
          encryption.DEKIdentifier.CONVERSATION,
          contents.get("m2") as string,
        ),
        "hello",
      );
    });
  });
});
