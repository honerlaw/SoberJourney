import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushNotificationScheduleModel } from "../../../generated/prisma/models.js";
import { UserPushNotificationScheduleFrequency } from "../../../generated/prisma/enums.js";

export type PendingSchedule = UserPushNotificationScheduleModel & {
  user: {
    id: string;
    pushTokens: {
      id: string;
      token: string;
      revoked: boolean;
    }[];
  };
  checkIn:
    | {
        id: string;
        journey: {
          id: string;
          title: string;
        };
      }
    | null
    | undefined;
};

/**
/**
 * Map of frequency to interval in milliseconds
 */
const FREQUENCY_INTERVAL_MS_MAP = {
  [UserPushNotificationScheduleFrequency.DAILY]: 24 * 60 * 60 * 1000,
  [UserPushNotificationScheduleFrequency.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [UserPushNotificationScheduleFrequency.BIWEEKLY]: 14 * 24 * 60 * 60 * 1000,
  [UserPushNotificationScheduleFrequency.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
};

/**
 * List all UserPushNotificationSchedule records that are pending notification.
 *
 * A schedule is pending if:
 * 1. There are no notifications associated with it, OR
 * 2. The last notification was sent older than the frequency interval
 *    (plus minuteOfDay offset if defined)
 */
export async function listPending(
  logger: Logger,
  client: DBClient,
): Promise<PendingSchedule[]> {
  try {
    const now = new Date();
    const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

    // Get all schedules with their latest notification
    const schedules = await client.userPushNotificationSchedule.findMany({
      include: {
        user: {
          select: {
            id: true,
          },
          include: {
            pushTokens: {
              select: {
                id: true,
                token: true,
                revoked: true,
              },
            },
          },
        },
        checkIn: {
          select: {
            id: true,
            journey: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        notifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
      where: {
        user: {
          pushTokens: {
            some: {
              revoked: false,
            },
          },
        },
      },
    });

    // Filter schedules that are pending
    const pendingSchedules: PendingSchedule[] = [];

    for (const schedule of schedules) {
      const lastNotification = schedule.notifications[0];

      // Case 1: No notifications have been sent for this schedule
      if (!lastNotification) {
        // If minuteOfDay is defined, check if we've reached that time
        if (schedule.minuteOfDay !== null) {
          if (currentMinuteOfDay >= schedule.minuteOfDay) {
            pendingSchedules.push({
              id: schedule.id,
              userId: schedule.userId,
              user: schedule.user,
              checkInId: schedule.checkInId,
              checkIn: schedule.checkIn,
              frequency: schedule.frequency,
              minuteOfDay: schedule.minuteOfDay,
              createdAt: schedule.createdAt,
              updatedAt: schedule.updatedAt,
            });
          }
        } else {
          // No minuteOfDay constraint, always pending
          pendingSchedules.push({
            id: schedule.id,
            userId: schedule.userId,
            user: schedule.user,
            checkInId: schedule.checkInId,
            checkIn: schedule.checkIn,
            frequency: schedule.frequency,
            minuteOfDay: schedule.minuteOfDay,
            createdAt: schedule.createdAt,
            updatedAt: schedule.updatedAt,
          });
        }
        continue;
      }

      // Case 2: Check if enough time has passed since the last notification
      const frequencyIntervalMs = FREQUENCY_INTERVAL_MS_MAP[schedule.frequency];
      const lastNotificationTime = lastNotification.createdAt.getTime();
      const nextNotificationTime = lastNotificationTime + frequencyIntervalMs;

      // If minuteOfDay is defined, adjust the next notification time
      // to be at the specified minute of the day
      if (schedule.minuteOfDay !== null) {
        const nextDate = new Date(nextNotificationTime);
        // Set to the beginning of the day, then add minuteOfDay
        nextDate.setHours(0, 0, 0, 0);
        nextDate.setMinutes(schedule.minuteOfDay);

        // If the adjusted time is in the past relative to now, it's pending
        if (nextDate.getTime() <= now.getTime()) {
          pendingSchedules.push({
            id: schedule.id,
            userId: schedule.userId,
            user: schedule.user,
            checkInId: schedule.checkInId,
            checkIn: schedule.checkIn,
            frequency: schedule.frequency,
            minuteOfDay: schedule.minuteOfDay,
            createdAt: schedule.createdAt,
            updatedAt: schedule.updatedAt,
          });
        }
      } else {
        // No minuteOfDay constraint, just check if frequency interval has passed
        if (nextNotificationTime <= now.getTime()) {
          pendingSchedules.push({
            id: schedule.id,
            userId: schedule.userId,
            user: schedule.user,
            checkInId: schedule.checkInId,
            checkIn: schedule.checkIn,
            frequency: schedule.frequency,
            minuteOfDay: schedule.minuteOfDay,
            createdAt: schedule.createdAt,
            updatedAt: schedule.updatedAt,
          });
        }
      }
    }

    return pendingSchedules;
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "schedule", "listPending"],
      },
      "Failed to list pending notification schedules",
    );
    return [];
  }
}
