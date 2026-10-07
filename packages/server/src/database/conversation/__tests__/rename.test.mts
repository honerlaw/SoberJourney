import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import type { DBClient } from "../../../util/database.mjs";
import { rename } from "../rename.mjs";
import { setTitleIfNull } from "../setTitleIfNull.mjs";

type Row = {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A tiny in-memory stand-in for the two statements involved: rename's raw
 * UPDATE (which, like Postgres, does not touch updatedAt) and
 * setTitleIfNull's conditional updateMany.
 */
function fakeDb(rows: Row[]) {
  const sql: string[] = [];
  const client = {
    $executeRaw: mock.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        sql.push(strings.join("?"));
        const [title, id, userId] = values as [string, string, string];
        const row = rows.find((r) => r.id === id && r.userId === userId);
        if (!row) return 0;
        row.title = title;
        return 1;
      },
    ),
    conversation: {
      findFirst: mock.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          rows.find((r) => r.id === where.id && r.userId === where.userId) ??
          null,
      ),
      updateMany: mock.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; userId: string };
          data: { title: string };
        }) => {
          const row = rows.find(
            (r) =>
              r.id === where.id &&
              r.userId === where.userId &&
              (r.title === null || r.title === ""),
          );
          if (!row) return { count: 0 };
          row.title = data.title;
          row.updatedAt = new Date(row.updatedAt.getTime() + 1000);
          return { count: 1 };
        },
      ),
    },
  };
  return { client: client as unknown as DBClient, sql, mocks: client };
}

const row = (title: string | null): Row => ({
  id: "c1",
  userId: "user-1",
  title,
  createdAt: new Date(1),
  updatedAt: new Date(5),
});

describe("rename", () => {
  it("sets the title with a parameterized raw UPDATE scoped to the owner, without bumping updatedAt", async () => {
    const rows = [row("Old")];
    const { client, sql } = fakeDb(rows);
    const { logger } = mockLogger();

    const result = await rename(logger, client, "c1", "user-1", "My title");

    assert.equal(result?.title, "My title");
    assert.deepEqual(result?.updatedAt, new Date(5));
    assert.deepEqual(sql, [
      'UPDATE "Conversation" SET "title" = ? WHERE "id" = ? AND "userId" = ?',
    ]);
  });

  it("returns null when the conversation is missing or owned by someone else", async () => {
    const { client } = fakeDb([row("Old")]);
    const { logger } = mockLogger();
    assert.equal(await rename(logger, client, "c1", "user-2", "x"), null);
    assert.equal(await rename(logger, client, "nope", "user-1", "x"), null);
  });

  it("returns null on a database error", async () => {
    const { logger } = mockLogger();
    const client = {
      $executeRaw: async () => {
        throw new Error("db down");
      },
    } as unknown as DBClient;
    assert.equal(await rename(logger, client, "c1", "user-1", "x"), null);
  });
});

describe("rename vs auto-generated titles", () => {
  it("an auto title generated after a rename never overwrites it", async () => {
    const rows = [row(null)];
    const { client } = fakeDb(rows);
    const { logger } = mockLogger();

    await rename(logger, client, "c1", "user-1", "Mine");
    const wrote = await setTitleIfNull(
      logger,
      client,
      "c1",
      "user-1",
      "Auto title",
    );

    assert.equal(wrote, false);
    assert.equal(rows[0]!.title, "Mine");
  });

  it("a rename after an auto title replaces it", async () => {
    const rows = [row(null)];
    const { client } = fakeDb(rows);
    const { logger } = mockLogger();

    assert.equal(
      await setTitleIfNull(logger, client, "c1", "user-1", "Auto title"),
      true,
    );
    await rename(logger, client, "c1", "user-1", "Mine");

    assert.equal(rows[0]!.title, "Mine");
  });
});
