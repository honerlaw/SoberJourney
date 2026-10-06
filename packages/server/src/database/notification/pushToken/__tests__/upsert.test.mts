import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { upsert } from "../upsert.mjs";
import { mockLogger } from "../../../../util/__mocks__/logger.mjs";
import type { DBClient } from "../../../../util/database.mjs";

describe("pushToken.upsert", () => {
  function harness() {
    const row = { id: "row", userId: "user-b", token: "tok", revoked: false };
    const tx = {
      userPushToken: {
        updateMany: mock.fn(async (_args: unknown) => ({ count: 1 })),
        upsert: mock.fn(async (_args: unknown) => row),
      },
    };
    const $transaction = mock.fn(async (fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    const client = { $transaction } as unknown as DBClient;
    return { tx, client, row, $transaction };
  }

  it("revokes the token for other users and re-enables it for this user", async () => {
    const { logger } = mockLogger();
    const { tx, client, row, $transaction } = harness();

    const result = await upsert(logger, client, "user-b", "tok");

    assert.equal(result, row);
    assert.equal($transaction.mock.callCount(), 1);
    assert.deepEqual(tx.userPushToken.updateMany.mock.calls[0]!.arguments[0], {
      where: { token: "tok", userId: { not: "user-b" }, revoked: false },
      data: { revoked: true },
    });
    assert.deepEqual(tx.userPushToken.upsert.mock.calls[0]!.arguments[0], {
      where: { userId_token: { userId: "user-b", token: "tok" } },
      update: { revoked: false },
      create: { userId: "user-b", token: "tok" },
    });
  });

  it("returns null when the transaction fails", async () => {
    const { logger } = mockLogger();
    const client = {
      $transaction: mock.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as DBClient;

    assert.equal(await upsert(logger, client, "user-b", "tok"), null);
  });
});
