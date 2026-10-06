import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type UserPushNotificationModel } from "../../generated/prisma/models.js";
import { PushNotificationStatus } from "../../generated/prisma/enums.js";

/**
 * Create a new notification record for tracking a sent push notification.
 * Each notification send should create a new record.
 *
 * `receiptId` is null for a ticket failure (Expo rejected the message or its
 * chunk failed); Postgres treats NULLs as distinct in the
 * (pushTokenId, scheduleId, receiptId) unique key, so repeated failures can
 * be recorded. `createdAt` lets a cron run stamp all of its rows with the
 * run's start time (one attempt = one distinct createdAt).
 */
export async function create(
  logger: Logger,
  client: DBClient,
  pushTokenId: string,
  scheduleId: string,
  receiptId: string | null,
  status: PushNotificationStatus,
  errorMessage: string | null,
  createdAt?: Date,
): Promise<UserPushNotificationModel | null> {
  try {
    return await client.userPushNotification.create({
      data: {
        scheduleId,
        pushTokenId,
        receiptId,
        status,
        errorMessage,
        ...(createdAt ? { createdAt } : {}),
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "create"],
      },
      "Failed to create notification record",
    );
    return null;
  }
}
