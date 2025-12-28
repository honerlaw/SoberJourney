import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type UserPushNotificationModel } from "../../generated/prisma/models.js";
import { PushNotificationStatus } from "../../generated/prisma/enums.js";

/**
 * List all push notifications that are PENDING and have a receiptId defined.
 * These are notifications that have been sent but need receipt confirmation.
 */
export async function listPendingWithReceipt(
  logger: Logger,
  client: DBClient,
): Promise<UserPushNotificationModel[]> {
  try {
    return await client.userPushNotification.findMany({
      where: {
        status: PushNotificationStatus.PENDING,
        receiptId: {
          not: null,
        },
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "listPendingWithReceipt"],
      },
      "Failed to list pending notifications with receipt",
    );
    return [];
  }
}
