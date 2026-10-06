import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushNotificationScheduleModel } from "../../../generated/prisma/models.js";
import { isSchedulePending, NOTIFICATION_HISTORY_WINDOW } from "./timing.mjs";

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
 * List all UserPushNotificationSchedule records that are due to be sent.
 *
 * Only non-revoked push tokens are loaded. Each schedule is evaluated in
 * isolation (see `isSchedulePending` in `./timing.mts`): a schedule that
 * fails to evaluate (e.g. an invalid user timezone) is logged and skipped
 * instead of blocking every other schedule.
 */
export async function listPending(
  logger: Logger,
  client: DBClient,
  now: Date = new Date(),
): Promise<PendingSchedule[]> {
  let schedules;
  try {
    schedules = await client.userPushNotificationSchedule.findMany({
      include: {
        user: {
          select: {
            id: true,
            timezone: true,
            pushTokens: {
              where: {
                revoked: false,
              },
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
          take: NOTIFICATION_HISTORY_WINDOW,
          select: {
            createdAt: true,
            status: true,
            receiptId: true,
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

  const pendingSchedules: PendingSchedule[] = [];

  for (const schedule of schedules) {
    try {
      const pending = isSchedulePending({
        now,
        createdAt: schedule.createdAt,
        frequency: schedule.frequency,
        minuteOfDay: schedule.minuteOfDay,
        timezone: schedule.user.timezone,
        notifications: schedule.notifications,
      });

      if (!pending) {
        continue;
      }

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
    } catch (err) {
      logger.error(
        {
          error: err,
          attributes: {
            scheduleId: schedule.id,
            timezone: schedule.user.timezone,
          },
          tags: ["database", "notification", "schedule", "listPending"],
        },
        "Failed to evaluate notification schedule, skipping",
      );
    }
  }

  return pendingSchedules;
}
