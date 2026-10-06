import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { listPending } from "../listPending.mjs";
import { mockLogger } from "../../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../../util/__mocks__/database.mjs";
import { UserPushNotificationScheduleFrequency } from "../../../../generated/prisma/enums.js";

function schedule(id: string, timezone: string) {
  return {
    id,
    userId: `user-${id}`,
    checkInId: `checkin-${id}`,
    frequency: UserPushNotificationScheduleFrequency.DAILY,
    minuteOfDay: 0,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    user: {
      id: `user-${id}`,
      timezone,
      pushTokens: [{ id: `token-${id}`, token: "t", revoked: false }],
    },
    checkIn: { id: `checkin-${id}`, journey: { id: "j", title: "J" } },
    notifications: [],
  };
}

describe("listPending", () => {
  it("skips a schedule with an invalid timezone without blocking others", async () => {
    const { logger, mocked: loggerMock } = mockLogger();
    const findMany = mock.fn(async () => [
      schedule("a", "America/New_York"),
      schedule("bad", "Not/AZone"),
      schedule("c", "Europe/London"),
    ]);
    const { client } = mockDatabase({
      userPushNotificationSchedule: { findMany },
    });

    const result = await listPending(
      logger,
      client,
      new Date("2026-06-10T12:00:00Z"),
    );

    assert.deepEqual(
      result.map((s) => s.id),
      ["a", "c"],
    );
    assert.equal(loggerMock.error.mock.callCount(), 1);
  });

  it("only loads non-revoked push tokens", async () => {
    const { logger } = mockLogger();
    const findMany = mock.fn(async (_args: unknown) => []);
    const { client } = mockDatabase({
      userPushNotificationSchedule: { findMany },
    });

    await listPending(logger, client, new Date("2026-06-10T12:00:00Z"));

    const args = findMany.mock.calls[0]!.arguments[0] as {
      include: { user: { select: { pushTokens: { where: unknown } } } };
      where: unknown;
    };
    assert.deepEqual(args.include.user.select.pushTokens.where, {
      revoked: false,
    });
    assert.deepEqual(args.where, {
      user: { pushTokens: { some: { revoked: false } } },
    });
  });

  it("returns [] when the query fails", async () => {
    const { logger } = mockLogger();
    const findMany = mock.fn(async () => {
      throw new Error("db down");
    });
    const { client } = mockDatabase({
      userPushNotificationSchedule: { findMany },
    });

    assert.deepEqual(await listPending(logger, client), []);
  });
});
