import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { create } from "../create.mjs";
import { expireStalePending } from "../expireStalePending.mjs";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../util/__mocks__/database.mjs";
import { PushNotificationStatus } from "../../../generated/prisma/enums.js";

describe("notification records", () => {
  it("create records a ticket failure with a null receipt and the run's createdAt", async () => {
    const { logger } = mockLogger();
    const createFn = mock.fn(async (_args: unknown) => ({}) as never);
    const { client } = mockDatabase({
      userPushNotification: { create: createFn },
    });
    const runAt = new Date("2026-06-10T13:00:00Z");

    await create(
      logger,
      client,
      "pt-1",
      "s1",
      null,
      PushNotificationStatus.ERROR,
      "MessageRateExceeded",
      runAt,
    );

    assert.deepEqual(createFn.mock.calls[0]!.arguments[0], {
      data: {
        scheduleId: "s1",
        pushTokenId: "pt-1",
        receiptId: null,
        status: PushNotificationStatus.ERROR,
        errorMessage: "MessageRateExceeded",
        createdAt: runAt,
      },
    });
  });

  it("create leaves createdAt to the database when not given", async () => {
    const { logger } = mockLogger();
    const createFn = mock.fn(async (_args: unknown) => ({}) as never);
    const { client } = mockDatabase({
      userPushNotification: { create: createFn },
    });

    await create(
      logger,
      client,
      "pt-1",
      "s1",
      "r1",
      PushNotificationStatus.PENDING,
      null,
    );

    const args = createFn.mock.calls[0]!.arguments[0] as {
      data: Record<string, unknown>;
    };
    assert.equal("createdAt" in args.data, false);
  });

  it("expireStalePending marks old pending records as expired errors", async () => {
    const { logger } = mockLogger();
    const updateMany = mock.fn(async (_args: unknown) => ({ count: 2 }));
    const { client } = mockDatabase({
      userPushNotification: { updateMany },
    });
    const cutoff = new Date("2026-06-09T13:00:00Z");

    assert.equal(await expireStalePending(logger, client, cutoff), 2);
    assert.deepEqual(updateMany.mock.calls[0]!.arguments[0], {
      where: {
        status: PushNotificationStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      data: {
        status: PushNotificationStatus.ERROR,
        errorMessage: "ReceiptExpired",
      },
    });
  });
});
