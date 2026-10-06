import {
  type DBClient,
  type UserJourneyModelWithEntries,
} from "../../util/database.mjs";
import { type UserPushNotificationScheduleFrequency } from "../../generated/prisma/enums.js";
import { type Logger } from "../../util/logger/index.mjs";

type NotificationSettings = {
  frequency: UserPushNotificationScheduleFrequency;
  minuteOfDay: number;
};

/**
 * Create a journey with its first entry and, when notification settings are
 * given, its check-in + notification schedule. Uses a single nested create so
 * everything is written atomically (no partial journey on failure).
 *
 * Note: the schedule fields mirror database/notification/schedule/upsert,
 * keep the two in sync if schedule creation changes.
 */
export async function create(
  logger: Logger,
  client: DBClient,
  userId: string,
  title: string,
  startDateTime: Date,
  notificationSettings?: NotificationSettings,
): Promise<UserJourneyModelWithEntries | null> {
  try {
    return await client.userJourney.create({
      data: {
        title,
        userId,
        entries: {
          create: {
            createdAt: startDateTime,
          },
        },
        ...(notificationSettings
          ? {
              checkIn: {
                create: {
                  userId,
                  pushNotificationSchedule: {
                    create: {
                      userId,
                      frequency: notificationSettings.frequency,
                      minuteOfDay: notificationSettings.minuteOfDay,
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        entries: true,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journey", "create"],
      },
      "Failed to create user journey",
    );
    return null;
  }
}
