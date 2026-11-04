import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushNotificationScheduleModel } from "../../../generated/prisma/models.js";

/**
 * Get the user's notification schedule for a check-in. Filters on the user
 * too, so the query itself enforces ownership.
 */
export async function getByCheckInId(
  logger: Logger,
  client: DBClient,
  userId: string,
  checkInId: string,
): Promise<UserPushNotificationScheduleModel | null> {
  try {
    return await client.userPushNotificationSchedule.findFirst({
      where: {
        checkInId,
        userId,
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
