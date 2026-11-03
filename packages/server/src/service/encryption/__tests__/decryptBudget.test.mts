import { afterEach, describe, it, mock, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { mockConfig } from "../../../util/__mocks__/config.mjs";

async function harness(context: TestContext) {
  mockConfig(context, async () => "test");
  const { encrypt } = await import("../encrypt.mjs");
  const { decrypt, decryptMany } = await import("../decrypt.mjs");
  const { DEKIdentifier } = await import("../getDEK.mjs");
  const { resetDecryptBudget, DECRYPT_BUDGET_MESSAGE } =
    await import("../decryptBudget.mjs");
  resetDecryptBudget();

  const storedKeys = new Map<string, string>();

  function createCtx(userId: string) {
    const findUnique = mock.fn(async (args: { where: { userId: string } }) => {
      const key = storedKeys.get(args.where.userId);
      return key === undefined ? null : { key };
    });
    const upsert = mock.fn(async (id: string, key: string) => {
      if (!storedKeys.has(id)) storedKeys.set(id, key);
      return { userId: id, key: storedKeys.get(id) as string };
    });
    const ctx = {
      auth: { user: { id: userId } },
      database: {
        client: { userKey: { findUnique } },
        user: { key: { upsert } },
      },
    } as unknown as Parameters<typeof encrypt>[0];
    return { ctx, findUnique };
  }

  const isTooMany = (error: unknown) =>
    error instanceof TRPCError &&
    error.code === "TOO_MANY_REQUESTS" &&
    error.message === DECRYPT_BUDGET_MESSAGE;

  return {
    createCtx,
    encrypt,
    decrypt,
    decryptMany,
    DEKIdentifier,
    isTooMany,
    resetDecryptBudget,
  };
}

describe("decrypt budget", () => {
  afterEach(() => {
    delete process.env.DECRYPT_LIMIT_PER_MINUTE;
    mock.restoreAll();
  });

  it("decryptMany keeps order and uses one key lookup", async (context) => {
    const { createCtx, encrypt, decryptMany, DEKIdentifier } =
      await harness(context);
    const write = createCtx("u1");
    const values = await Promise.all(
      ["a", "b", "c"].map((v) => encrypt(write.ctx, DEKIdentifier.JOURNAL, v)),
    );
    const read = createCtx("u1");
    assert.deepEqual(
      await decryptMany(read.ctx, DEKIdentifier.JOURNAL, values),
      ["a", "b", "c"],
    );
    assert.equal(read.findUnique.mock.callCount(), 1);
    assert.deepEqual(
      await decryptMany(read.ctx, DEKIdentifier.JOURNAL, []),
      [],
    );
  });

  it("rejects a decryptMany past 30,000 in a minute before decrypting anything", async (context) => {
    const { createCtx, encrypt, decryptMany, DEKIdentifier, isTooMany } =
      await harness(context);
    const write = createCtx("u1");
    const value = await encrypt(write.ctx, DEKIdentifier.JOURNAL, "x");

    // 29,999 already used this minute
    const { reserveDecrypts } = await import("../decryptBudget.mjs");
    reserveDecrypts(write.ctx, 29_999);

    const read = createCtx("u1");
    await assert.rejects(
      decryptMany(read.ctx, DEKIdentifier.JOURNAL, [value, value]),
      isTooMany,
    );
    // rejected before the key lookup, so nothing was decrypted
    assert.equal(read.findUnique.mock.callCount(), 0);

    // exactly at the budget still works
    assert.deepEqual(
      await decryptMany(read.ctx, DEKIdentifier.JOURNAL, [value]),
      ["x"],
    );
  });

  it("charges single decrypts one each and leaves other users alone", async (context) => {
    const { createCtx, encrypt, decrypt, DEKIdentifier, isTooMany } =
      await harness(context);
    process.env.DECRYPT_LIMIT_PER_MINUTE = "2";
    const a = createCtx("u1");
    const value = await encrypt(a.ctx, DEKIdentifier.JOURNAL, "x");
    await decrypt(a.ctx, DEKIdentifier.JOURNAL, value);
    await decrypt(a.ctx, DEKIdentifier.JOURNAL, value);
    await assert.rejects(
      decrypt(a.ctx, DEKIdentifier.JOURNAL, value),
      isTooMany,
    );

    const b = createCtx("u2");
    const other = await encrypt(b.ctx, DEKIdentifier.JOURNAL, "y");
    assert.equal(await decrypt(b.ctx, DEKIdentifier.JOURNAL, other), "y");
  });

  it("is disabled by DECRYPT_LIMIT_PER_MINUTE=0", async (context) => {
    const { createCtx, encrypt, decryptMany, DEKIdentifier } =
      await harness(context);
    process.env.DECRYPT_LIMIT_PER_MINUTE = "0";
    const { ctx } = createCtx("u1");
    const value = await encrypt(ctx, DEKIdentifier.JOURNAL, "x");
    const { reserveDecrypts } = await import("../decryptBudget.mjs");
    reserveDecrypts(ctx, 1_000_000);
    assert.deepEqual(await decryptMany(ctx, DEKIdentifier.JOURNAL, [value]), [
      "x",
    ]);
  });
});
