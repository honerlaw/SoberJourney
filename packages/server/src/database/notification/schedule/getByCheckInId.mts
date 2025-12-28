import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushNotificationScheduleModel } from "../../../generated/prisma/models.js";

/**
 * Get a notification schedule by check-in ID
 */
export async function getByCheckInId(
  logger: Logger,
  client: DBClient,
  checkInId: string,
): Promise<UserPushNotificationScheduleModel | null> {
  try {
    return await client.userPushNotificationSchedule.findUnique({
      where: {
        checkInId,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "schedule", "getByCheckInId"],
      },
      "Failed to get notification schedule by check-in ID",
    );
    return null;
  }
}
