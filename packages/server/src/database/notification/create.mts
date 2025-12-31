import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type UserPushNotificationModel } from "../../generated/prisma/models.js";
import { PushNotificationStatus } from "../../generated/prisma/enums.js";

/**
 * Create a new notification record for tracking a sent push notification.
 * Each notification send should create a new record.
 */
export async function create(
  logger: Logger,
  client: DBClient,
  pushTokenId: string,
  scheduleId: string,
  receiptId: string,
  status: PushNotificationStatus,
  errorMessage: string | null,
): Promise<UserPushNotificationModel | null> {
  try {
    return await client.userPushNotification.create({
      data: {
        scheduleId,
        pushTokenId,
        receiptId,
        status,
        errorMessage,
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
