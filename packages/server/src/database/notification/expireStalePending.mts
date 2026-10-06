import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { PushNotificationStatus } from "../../generated/prisma/enums.js";

const RECEIPT_EXPIRED_ERROR = "ReceiptExpired";

/**
 * Mark PENDING notifications created before `olderThan` as ERROR.
 * Expo only keeps receipts for about a day, so these will never resolve.
 * Returns the number of expired records.
 */
export async function expireStalePending(
  logger: Logger,
  client: DBClient,
  olderThan: Date,
): Promise<number> {
  try {
    const result = await client.userPushNotification.updateMany({
      where: {
        status: PushNotificationStatus.PENDING,
        createdAt: {
          lt: olderThan,
        },
      },
      data: {
        status: PushNotificationStatus.ERROR,
        errorMessage: RECEIPT_EXPIRED_ERROR,
      },
    });
    return result.count;
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "expireStalePending"],
      },
      "Failed to expire stale pending notifications",
    );
    return 0;
  }
}
