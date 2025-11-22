import { afterEach, describe, it, mock, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mockConfig } from "../../../util/__mocks__/config.mjs";

describe("Encryption Service", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  async function harness(context: TestContext) {
    mockConfig(context, async () => "test");
    const { encrypt } = await import("../encrypt.mjs");
    const { decrypt } = await import("../decrypt.mjs");
    const { DEKIdentifier, getDEK } = await import("../getDEK.mjs");

    // store the key in memory to mimic the database
    let storedKey: string | null = null;
    const ctx = {
      auth: {
        user: {
          id: "123",
        },
      },
      database: {
        user: {
          key: {
            upsert: mock.fn((userId, key) => {
              if (storedKey === null) {
                storedKey = key;
              }
              return Promise.resolve({
                userId,
                key: storedKey,
              });
            }),
          },
        },
      },
    } as unknown as Parameters<typeof encrypt>[0];

    return {
      ctx,
      encrypt,
      decrypt,
      DEKIdentifier,
      getDEK,
    };
  }

  it("should encrypt and decrypt data", async (context) => {
    const { ctx, encrypt, decrypt, DEKIdentifier } = await harness(context);

    const data = JSON.stringify({
      name: "John Doe",
      age: 30,
      email: "john.doe@example.com",
    });

    const encrypted = await encrypt(ctx, DEKIdentifier.TRANSACTIONS, data);
    const decrypted = await decrypt(ctx, DEKIdentifier.TRANSACTIONS, encrypted);

    assert.strictEqual(decrypted, data);
  });

  it("should bulk encrypt using the getDEK function", async (context) => {
    const { ctx, getDEK, DEKIdentifier } = await harness(context);

    const data = JSON.stringify({
      name: "John Doe",
      age: 30,
      email: "john.doe@example.com",
    });

    // its like 35ms per opt to encrypt and decrypt a string...
    const dek = await getDEK(ctx, DEKIdentifier.TRANSACTIONS);

    const start = performance.now();
    const totalRuns = 5000;
    for (let i = 0; i < totalRuns; i++) {
      dek.encrypt(data);
    }
    const end = performance.now();
    const average = (end - start) / totalRuns;

    // under 1ms per opt is good enough
    assert.ok(average < 1);
  });
});
