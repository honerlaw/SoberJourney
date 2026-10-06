import { mock } from "node:test";
import type { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import type { Context } from "../../context.mjs";
import type { PendingSchedule } from "../../database/notification/schedule/index.mjs";
import type { NotificationResult } from "../../datasource/expo/index.mjs";
import { mockLogger } from "../../util/__mocks__/logger.mjs";
import { UserPushNotificationScheduleFrequency } from "../../util/database.mjs";

export const validToken = (name: string) => `ExponentPushToken[${name}]`;

export function schedule(
  id: string,
  tokens: { id: string; token: string; revoked?: boolean }[],
): PendingSchedule {
  return {
    id,
    userId: `user-${id}`,
    checkInId: `checkin-${id}`,
    frequency: UserPushNotificationScheduleFrequency.DAILY,
    minuteOfDay: 540,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    user: {
      id: `user-${id}`,
      timezone: "America/New_York",
      pushTokens: tokens.map((t) => ({ revoked: false, ...t })),
    },
    checkIn: {
      id: `checkin-${id}`,
      journey: { id: `journey-${id}`, title: "J" },
    },
  };
}

export function createCronContext(options: {
  schedules?: PendingSchedule[];
  tickets?: (messages: ExpoPushMessage[]) => NotificationResult[];
}) {
  const { logger, mocked: loggerMock } = mockLogger();

  const defaultTickets = (messages: ExpoPushMessage[]) =>
    messages.map((message, index) => ({
      message,
      ticket: { status: "ok", id: `receipt-${index}` } as ExpoPushTicket,
    }));

  const database = {
    notification: {
      create: mock.fn(async (..._args: unknown[]) => ({})),
      update: mock.fn(async (..._args: unknown[]) => ({})),
      listPendingWithReceipt: mock.fn(async () => [] as unknown[]),
      expireStalePending: mock.fn(async (_olderThan: Date) => 0),
      schedule: {
        listPending: mock.fn(async (_now?: Date) => options.schedules ?? []),
      },
      pushToken: {
        revoke: mock.fn(async (_id: string) => ({})),
      },
    },
  };
  const expo = {
    notify: mock.fn(async (messages: ExpoPushMessage[]) =>
      (options.tickets ?? defaultTickets)(messages),
    ),
    getReceipts: mock.fn(
      async (_ids: string[]) => ({}) as Record<string, unknown>,
    ),
  };

  const ctx = {
    logger,
    database,
    datasource: { expo },
  } as unknown as Context;

  return { ctx, database, expo, loggerMock };
}
