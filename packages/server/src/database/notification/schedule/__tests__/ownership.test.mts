import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { getByCheckInId } from "../getByCheckInId.mjs";
import { remove } from "../upsert.mjs";
import { mockLogger } from "../../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../../util/__mocks__/database.mjs";

describe("notification schedule ownership", () => {
  it("getByCheckInId filters on the user id", async () => {
    const findFirst = mock.fn(async () => null);
    const { client } = mockDatabase({
      userPushNotificationSchedule: { findFirst: findFirst as never },
    });
    const { logger } = mockLogger();
    assert.equal(await getByCheckInId(logger, client, "u", "c"), null);
    assert.deepEqual(findFirst.mock.calls[0]?.arguments, [
      { where: { checkInId: "c", userId: "u" } },
    ] as never);
  });

  it("remove filters on the user id", async () => {
    const deleteMany = mock.fn(async () => ({ count: 0 }));
    const { client } = mockDatabase({
      userPushNotificationSchedule: { deleteMany: deleteMany as never },
    });
    const { logger } = mockLogger();
    assert.equal(await remove(logger, client, "u", "c"), true);
    assert.deepEqual(deleteMany.mock.calls[0]?.arguments, [
      { where: { checkInId: "c", userId: "u" } },
    ] as never);
  });
});
