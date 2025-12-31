import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type UserPushNotificationModel } from "../../generated/prisma/models.js";
import { PushNotificationStatus } from "../../generated/prisma/enums.js";

/**
 * Update an existing notification record by its unique identifier (pushTokenId + scheduleId + receiptId).
 * Used primarily by the receipts flow to update notification status after checking with Expo.
 */
export async function update(
  logger: Logger,
  client: DBClient,
  pushTokenId: string,
  scheduleId: string,
  receiptId: string,
  status: PushNotificationStatus,
  errorMessage: string | null,
): Promise<UserPushNotificationModel | null> {
  try {
    return await client.userPushNotification.update({
      where: {
        pushTokenId_scheduleId_receiptId: {
          pushTokenId,
          scheduleId,
          receiptId,
        },
      },
      data: {
        status,
        errorMessage,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "upsert"],
      },
      "Failed to update notification record",
    );
    return null;
  }
}
