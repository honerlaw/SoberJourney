import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import {
  notify,
  CHUNK_SEND_FAILED_ERROR,
  INVALID_TOKEN_ERROR,
} from "../notify.mjs";
import { getReceipts } from "../getReceipts.mjs";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";

const token = (i: number) => `ExponentPushToken[token-${i}]`;

describe("expo datasource", () => {
  it("notify keeps accepted chunks when another chunk fails, aligned by index", async () => {
    const { logger } = mockLogger();
    const messages: ExpoPushMessage[] = [
      { to: "not-a-token", body: "x" },
      ...Array.from({ length: 150 }, (_, i) => ({ to: token(i), body: "x" })),
    ];
    let call = 0;
    const client = {
      sendPushNotificationsAsync: mock.fn(async (chunk: ExpoPushMessage[]) => {
        call += 1;
        if (call === 2) {
          throw new Error("network");
        }
        return chunk.map((m) => ({ status: "ok", id: `receipt-${m.to}` }));
      }),
    } as unknown as Expo;

    const results = await notify(logger, client, messages);

    assert.equal(results.length, messages.length);
    results.forEach((r, i) => assert.equal(r.message, messages[i]));
    assert.equal(results[0]!.ticket, undefined);
    assert.equal(results[0]!.error, INVALID_TOKEN_ERROR);

    const firstChunk = results.slice(
      1,
      1 + Expo.pushNotificationChunkSizeLimit,
    );
    for (const r of firstChunk) {
      assert.deepEqual(r.ticket, {
        status: "ok",
        id: `receipt-${r.message.to}`,
      });
    }
    const failedChunk = results.slice(1 + Expo.pushNotificationChunkSizeLimit);
    assert.equal(failedChunk.length, 50);
    for (const r of failedChunk) {
      assert.equal(r.ticket, undefined);
      assert.equal(r.error, CHUNK_SEND_FAILED_ERROR);
    }
  });

  it("notify returns [] for no messages", async () => {
    const { logger } = mockLogger();
    const client = {
      sendPushNotificationsAsync: mock.fn(),
    } as unknown as Expo;
    assert.deepEqual(await notify(logger, client, []), []);
  });

  it("getReceipts returns the receipts of chunks that succeeded", async () => {
    const { logger, mocked } = mockLogger();
    const client = {
      chunkPushNotificationReceiptIds: (ids: string[]) => ids.map((id) => [id]),
      getPushNotificationReceiptsAsync: mock.fn(async (ids: string[]) => {
        if (ids[0] === "b") {
          throw new Error("network");
        }
        return { [ids[0]!]: { status: "ok" } };
      }),
    } as unknown as Expo;

    const receipts = await getReceipts(logger, client, ["a", "b", "c"]);

    assert.deepEqual(Object.keys(receipts).sort(), ["a", "c"]);
    assert.equal(mocked.error.mock.callCount(), 1);
  });
});
