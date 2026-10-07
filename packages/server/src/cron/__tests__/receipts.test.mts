import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { receipts } from "../receipts.mjs";
import { PushNotificationStatus } from "../../util/database.mjs";
import { createCronContext } from "./harness.mjs";

describe("cron receipts", () => {
  it("expires stale pending receipts and completes ok receipts", async () => {
    const now = new Date("2026-06-10T13:00:00Z");
    const { ctx, database, expo } = createCronContext({});
    database.notification.listPendingWithReceipt.mock.mockImplementation(
      async () => [
        { pushTokenId: "pt-1", scheduleId: "s1", receiptId: "r1" },
        { pushTokenId: "pt-2", scheduleId: "s2", receiptId: "r2" },
      ],
    );
    expo.getReceipts.mock.mockImplementation(async () => ({
      r1: { status: "ok" },
      r2: {
        status: "error",
        message: "dead",
        details: { error: "DeviceNotRegistered" },
      },
    }));

    await receipts(ctx, now);

    assert.equal(
      database.notification.expireStalePending.mock.calls[0]!.arguments[0].toISOString(),
      "2026-06-09T13:00:00.000Z",
    );
    assert.deepEqual(expo.getReceipts.mock.calls[0]!.arguments[0], [
      "r1",
      "r2",
    ]);
    assert.deepEqual(
      database.notification.update.mock.calls.map((c) => c.arguments),
      [
        ["pt-1", "s1", "r1", PushNotificationStatus.COMPLETE, null],
        [
          "pt-2",
          "s2",
          "r2",
          PushNotificationStatus.ERROR,
          "DeviceNotRegistered",
        ],
      ],
    );
    assert.deepEqual(
      database.notification.pushToken.revoke.mock.calls.map(
        (c) => c.arguments[0],
      ),
      ["pt-2"],
    );
  });
});
