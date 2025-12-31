import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type UserPushNotificationModel } from "../../generated/prisma/models.js";
import { PushNotificationStatus } from "../../generated/prisma/enums.js";

/**
 * Upsert a notification record for a check-in
 */
export async function upsert(
  logger: Logger,
  client: DBClient,
  pushTokenId: string,
  scheduleId: string,
  receiptId: string | null, // no receipt if errored
  status: PushNotificationStatus,
  errorMessage: string | null,
): Promise<UserPushNotificationModel | null> {
  try {
    return await client.userPushNotification.upsert({
      where:
        receiptId === null
          ? {
              pushTokenId_scheduleId: {
                pushTokenId,
                scheduleId,
              },
            }
          : {
              pushTokenId_scheduleId_receiptId: {
                pushTokenId,
                scheduleId,
                receiptId,
              },
            },
      create: {
        scheduleId,
        pushTokenId,
        receiptId,
        status,
        errorMessage,
      },
      update: {
        receiptId,
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
      "Failed to upsert check-in notification",
    );
    return null;
  }
}
