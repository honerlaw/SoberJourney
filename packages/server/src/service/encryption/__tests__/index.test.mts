import { afterEach, describe, it, mock, type TestContext } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import Cryptr from "cryptr";
import { mockConfig } from "../../../util/__mocks__/config.mjs";

const KEK_SECRET = "test";

/**
 * The encryption scheme as it existed before request-scoped caching. Used to
 * prove the ciphertext format did not change in either direction.
 */
const legacy = {
  wrapDek(dek: string) {
    return new Cryptr(KEK_SECRET).encrypt(dek);
  },
  dataCryptr(wrappedDek: string, identifier: string) {
    const dek = new Cryptr(KEK_SECRET).decrypt(wrappedDek);
    return new Cryptr(`${dek}:${identifier}`, { pbkdf2Iterations: 1000 });
  },
};

describe("Encryption Service", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  async function harness(context: TestContext, secret = KEK_SECRET) {
    mockConfig(context, async () => secret);
    const { encrypt } = await import("../encrypt.mjs");
    const { decrypt } = await import("../decrypt.mjs");
    const { DEKIdentifier, getDEK } = await import("../getDEK.mjs");

    // stored (KEK-wrapped) keys, mimicking the user_key table
    const storedKeys = new Map<string, string>();

    // builds a fresh ctx, i.e. a new request; the memo is per ctx object
    function createCtx(userId: string | null = "123") {
      const findUnique = mock.fn(
        async (args: { where: { userId: string } }) => {
          const key = storedKeys.get(args.where.userId);
          return key === undefined ? null : { key };
        },
      );
      const upsert = mock.fn(async (id: string, key: string) => {
        if (!storedKeys.has(id)) {
          storedKeys.set(id, key);
        }
        return { userId: id, key: storedKeys.get(id) as string };
      });
      const ctx = {
        auth: { user: userId === null ? null : { id: userId } },
        database: {
          client: { userKey: { findUnique } },
          user: { key: { upsert } },
        },
      } as unknown as Parameters<typeof encrypt>[0];

      return { ctx, findUnique, upsert };
    }

    return {
      createCtx,
      storedKeys,
      encrypt,
      decrypt,
      DEKIdentifier,
      getDEK,
    };
  }

  it("should encrypt and decrypt data", async (context) => {
    const { createCtx, encrypt, decrypt, DEKIdentifier } =
      await harness(context);
    const { ctx } = createCtx();

    const data = JSON.stringify({
      name: "John Doe",
      age: 30,
      email: "john.doe@example.com",
    });

    const encrypted = await encrypt(ctx, DEKIdentifier.CONVERSATION, data);
    const decrypted = await decrypt(ctx, DEKIdentifier.CONVERSATION, encrypted);

    assert.strictEqual(decrypted, data);

    // decrypts in a later request too
    const { ctx: nextRequest } = createCtx();
    assert.strictEqual(
      await decrypt(nextRequest, DEKIdentifier.CONVERSATION, encrypted),
      data,
    );
  });

  it("should perform one key lookup per request when decrypting N items", async (context) => {
    const { createCtx, encrypt, decrypt, DEKIdentifier } =
      await harness(context);

    const { ctx: writeCtx } = createCtx();
    const items = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        encrypt(writeCtx, DEKIdentifier.CONVERSATION, `message ${i}`),
      ),
    );
    const journal = await encrypt(writeCtx, DEKIdentifier.JOURNAL, "entry");

    const { ctx, findUnique, upsert } = createCtx();
    // sequential and concurrent decrypts, both identifiers
    for (const [i, item] of items.slice(0, 25).entries()) {
      assert.strictEqual(
        await decrypt(ctx, DEKIdentifier.CONVERSATION, item),
        `message ${i}`,
      );
    }
    const rest = await Promise.all(
      items
        .slice(25)
        .map((item) => decrypt(ctx, DEKIdentifier.CONVERSATION, item)),
    );
    assert.deepStrictEqual(
      rest,
      Array.from({ length: 25 }, (_, i) => `message ${i + 25}`),
    );
    assert.strictEqual(
      await decrypt(ctx, DEKIdentifier.JOURNAL, journal),
      "entry",
    );

    assert.strictEqual(findUnique.mock.callCount(), 1);
    assert.strictEqual(upsert.mock.callCount(), 0);
  });

  it("should return the same Cryptr for repeated getDEK calls in a request", async (context) => {
    const { createCtx, getDEK, DEKIdentifier } = await harness(context);
    const { ctx } = createCtx();

    const first = await getDEK(ctx, DEKIdentifier.CONVERSATION);
    const second = await getDEK(ctx, DEKIdentifier.CONVERSATION);
    const journal = await getDEK(ctx, DEKIdentifier.JOURNAL);

    assert.strictEqual(first, second);
    assert.notStrictEqual(first, journal);
  });

  it("should create the key only once on concurrent first use", async (context) => {
    const { createCtx, encrypt, DEKIdentifier, storedKeys } =
      await harness(context);
    const { ctx, findUnique, upsert } = createCtx();

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        encrypt(ctx, DEKIdentifier.JOURNAL, `entry ${i}`),
      ),
    );

    assert.strictEqual(findUnique.mock.callCount(), 1);
    assert.strictEqual(upsert.mock.callCount(), 1);
    assert.strictEqual(storedKeys.size, 1);
  });

  it("should not create a key when one already exists", async (context) => {
    const { createCtx, encrypt, DEKIdentifier, storedKeys } =
      await harness(context);
    storedKeys.set("123", legacy.wrapDek("existing"));
    const { ctx, upsert } = createCtx();

    await encrypt(ctx, DEKIdentifier.JOURNAL, "entry");

    assert.strictEqual(upsert.mock.callCount(), 0);
    assert.strictEqual(storedKeys.size, 1);
  });

  it("should look the key up again in a new request", async (context) => {
    const { createCtx, encrypt, DEKIdentifier } = await harness(context);

    const first = createCtx();
    const second = createCtx();
    await encrypt(first.ctx, DEKIdentifier.JOURNAL, "a");
    await encrypt(first.ctx, DEKIdentifier.JOURNAL, "b");
    await encrypt(second.ctx, DEKIdentifier.JOURNAL, "c");

    assert.strictEqual(first.findUnique.mock.callCount(), 1);
    assert.strictEqual(second.findUnique.mock.callCount(), 1);
  });

  it("should scope the memo by user id", async (context) => {
    const { createCtx, getDEK, DEKIdentifier } = await harness(context);
    const { ctx, findUnique } = createCtx("123");

    const userA = await getDEK(ctx, DEKIdentifier.JOURNAL);
    (ctx.auth.user as { id: string }).id = "456";
    const userB = await getDEK(ctx, DEKIdentifier.JOURNAL);

    assert.notStrictEqual(userA, userB);
    assert.deepStrictEqual(
      findUnique.mock.calls.map((call) => call.arguments[0].where.userId),
      ["123", "456"],
    );
  });

  it("should re-read the key when the insert lost a race", async (context) => {
    const { createCtx, encrypt, decrypt, DEKIdentifier, storedKeys } =
      await harness(context);
    const { ctx, findUnique, upsert } = createCtx();

    // another request inserts the key between our read and our insert; the
    // database wrapper swallows the P2002 and returns null
    const winner = legacy.wrapDek(crypto.randomBytes(32).toString("hex"));
    upsert.mock.mockImplementation(async () => {
      storedKeys.set("123", winner);
      return null as unknown as { userId: string; key: string };
    });

    const encrypted = await encrypt(ctx, DEKIdentifier.JOURNAL, "entry");

    assert.strictEqual(findUnique.mock.callCount(), 2);
    assert.strictEqual(storedKeys.get("123"), winner);
    assert.strictEqual(
      legacy.dataCryptr(winner, DEKIdentifier.JOURNAL).decrypt(encrypted),
      "entry",
    );
    assert.strictEqual(
      await decrypt(createCtx().ctx, DEKIdentifier.JOURNAL, encrypted),
      "entry",
    );
  });

  it("should not cache a failed key lookup", async (context) => {
    const { createCtx, encrypt, DEKIdentifier } = await harness(context);
    const { ctx, upsert } = createCtx();

    upsert.mock.mockImplementationOnce(
      async () => null as unknown as { userId: string; key: string },
    );
    await assert.rejects(
      encrypt(ctx, DEKIdentifier.JOURNAL, "entry"),
      /Failed to create or read user key/,
    );

    // same request, the database recovered
    const encrypted = await encrypt(ctx, DEKIdentifier.JOURNAL, "entry");
    assert.ok(encrypted.length > 0);
  });

  it("should reject when there is no user", async (context) => {
    const { createCtx, encrypt, DEKIdentifier } = await harness(context);
    const { ctx } = createCtx(null);

    await assert.rejects(
      encrypt(ctx, DEKIdentifier.JOURNAL, "entry"),
      /User not found/,
    );
  });

  it("should build the KEK once, not per request", async (context) => {
    // a secret no other test uses, so the module-level cache starts cold
    const { createCtx, encrypt, DEKIdentifier } = await harness(
      context,
      "kek-once-secret",
    );
    const construct = context.mock.method(Cryptr, "CryptrAsync");

    for (const userId of ["1", "2", "3"]) {
      const { ctx } = createCtx(userId);
      await encrypt(ctx, DEKIdentifier.JOURNAL, "a");
      await encrypt(createCtx(userId).ctx, DEKIdentifier.CONVERSATION, "b");
    }

    const kekConstructions = construct.mock.calls.filter(
      (call) => call.arguments[0] === "kek-once-secret",
    );
    assert.strictEqual(kekConstructions.length, 1);
  });

  it("should decrypt data written by the legacy scheme", async (context) => {
    const { createCtx, decrypt, DEKIdentifier, storedKeys } =
      await harness(context);
    const wrapped = legacy.wrapDek(crypto.randomBytes(32).toString("hex"));
    storedKeys.set("123", wrapped);
    const ciphertext = legacy
      .dataCryptr(wrapped, DEKIdentifier.CONVERSATION)
      .encrypt("hello from an old row");

    const { ctx } = createCtx();
    assert.strictEqual(
      await decrypt(ctx, DEKIdentifier.CONVERSATION, ciphertext),
      "hello from an old row",
    );
  });

  it("should write data the legacy scheme can decrypt", async (context) => {
    const { createCtx, encrypt, DEKIdentifier, storedKeys } =
      await harness(context);
    const { ctx } = createCtx();

    const ciphertext = await encrypt(ctx, DEKIdentifier.JOURNAL, "new row");

    // the newly created key is wrapped in the legacy KEK format too
    const wrapped = storedKeys.get("123") as string;
    assert.strictEqual(
      legacy.dataCryptr(wrapped, DEKIdentifier.JOURNAL).decrypt(ciphertext),
      "new row",
    );
  });
});
