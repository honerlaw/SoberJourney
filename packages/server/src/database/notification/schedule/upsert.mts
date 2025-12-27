import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushNotificationScheduleModel } from "../../../generated/prisma/models.js";
import { type UserPushNotificationScheduleFrequency } from "../../../generated/prisma/enums.js";

/**
 * Create or update a notification schedule for a check-in
 */
export async function upsert(
  logger: Logger,
  client: DBClient,
  userId: string,
  checkInId: string,
  frequency: UserPushNotificationScheduleFrequency,
  minuteOfDay: number,
): Promise<UserPushNotificationScheduleModel | null> {
  try {
    return await client.userPushNotificationSchedule.upsert({
      where: {
        checkInId,
      },
      create: {
        userId,
        checkInId,
        frequency,
        minuteOfDay,
      },
      update: {
        frequency,
        minuteOfDay,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "schedule", "upsert"],
      },
      "Failed to upsert notification schedule",
    );
    return null;
  }
}

/**
 * Delete a notification schedule by check-in ID
 */
export async function remove(
  logger: Logger,
  client: DBClient,
  checkInId: string,
): Promise<boolean> {
  try {
    await client.userPushNotificationSchedule.deleteMany({
      where: {
        checkInId,
      },
    });
    return true;
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "schedule", "remove"],
      },
      "Failed to remove notification schedule",
    );
    return false;
  }
}
