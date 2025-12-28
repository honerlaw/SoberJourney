import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushNotificationScheduleModel } from "../../../generated/prisma/models.js";
import { UserPushNotificationScheduleFrequency } from "../../../generated/prisma/enums.js";

export type PendingSchedule = UserPushNotificationScheduleModel & {
  user: {
    id: string;
    timezone: string;
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
 * Map of frequency to interval in milliseconds
 */
const FREQUENCY_INTERVAL_MS_MAP = {
  [UserPushNotificationScheduleFrequency.DAILY]: 24 * 60 * 60 * 1000,
  [UserPushNotificationScheduleFrequency.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [UserPushNotificationScheduleFrequency.BIWEEKLY]: 14 * 24 * 60 * 60 * 1000,
  [UserPushNotificationScheduleFrequency.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Get the current minute of day in the specified timezone
 */
function getCurrentMinuteOfDayInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );

  return hour * 60 + minute;
}

/**
 * Get the start of day in the specified timezone as a Date object
 */
function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  // Create a date string in the timezone and parse it
  // This gives us midnight in the user's timezone
  const dateStr = `${year}-${month}-${day}T00:00:00`;

  // Create a formatter that can give us the offset
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  });

  const offsetParts = offsetFormatter.formatToParts(date);
  const tzOffset = offsetParts.find((p) => p.type === "timeZoneName")?.value;

  // Parse the offset (e.g., "GMT-05:00" -> "-05:00")
  const offsetMatch = tzOffset?.match(/GMT([+-]\d{2}:\d{2})/);
  const offset = offsetMatch ? offsetMatch[1] : "+00:00";

  return new Date(`${dateStr}${offset}`);
}

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

    // Get all schedules with their latest notification
    const schedules = await client.userPushNotificationSchedule.findMany({
      include: {
        user: {
          select: {
            id: true,
            timezone: true,
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
      const userTimezone = schedule.user.timezone;

      // Calculate current minute of day in the user's timezone
      const currentMinuteOfDay = getCurrentMinuteOfDayInTimezone(
        now,
        userTimezone,
      );

      // Case 1: No notifications have been sent for this schedule
      if (!lastNotification) {
        // If minuteOfDay is defined, check if we've reached that time in user's timezone
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
      // to be at the specified minute of the day in the user's timezone
      if (schedule.minuteOfDay !== null) {
        const nextDate = new Date(nextNotificationTime);
        // Get the start of day in the user's timezone
        const startOfDay = getStartOfDayInTimezone(nextDate, userTimezone);
        // Add the minuteOfDay offset
        const targetTime = new Date(
          startOfDay.getTime() + schedule.minuteOfDay * 60 * 1000,
        );

        // If the adjusted time is in the past relative to now, it's pending
        if (targetTime.getTime() <= now.getTime()) {
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
