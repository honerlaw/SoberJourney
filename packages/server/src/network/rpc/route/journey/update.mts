import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { UserPushNotificationScheduleFrequency } from "../../../../generated/prisma/enums.js";

const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum([
    UserPushNotificationScheduleFrequency.DAILY,
    UserPushNotificationScheduleFrequency.WEEKLY,
    UserPushNotificationScheduleFrequency.BIWEEKLY,
    UserPushNotificationScheduleFrequency.MONTHLY,
  ]),
  minuteOfDay: z.number().min(0).max(1439), // 0-1439 (24 hours * 60 minutes - 1)
});

const updateJourneyInput = z.object({
  journeyId: z.uuid(),
  title: z.string().min(1, "Journey name is required."),
  notificationSettings: notificationSettingsSchema.optional(),
});

export const update = procedure
  .input(updateJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const journey = await ctx.database.journey.update(
      input.journeyId,
      ctx.auth.user.id,
      input.title,
    );

    if (!journey) {
      throw new InternalServerError("Failed to update journey.");
    }

    // Handle notification settings if provided
    if (input.notificationSettings) {
      const { enabled, frequency, minuteOfDay } = input.notificationSettings;

      if (!enabled) {
        // If disabling notifications, remove the schedule
        const checkIn = await ctx.database.checkin.getByJourneyId(
          input.journeyId,
          ctx.auth.user.id,
        );

        if (checkIn) {
          await ctx.database.notification.schedule.remove(checkIn.id);
        }
      } else {
        // If enabling notifications, get or create check-in and upsert schedule
        const checkIn = await ctx.database.checkin.getOrCreate(
          input.journeyId,
          ctx.auth.user.id,
        );

        if (!checkIn) {
          throw new InternalServerError(
            "Failed to create check-in for notifications.",
          );
        }

        const schedule = await ctx.database.notification.schedule.upsert(
          ctx.auth.user.id,
          checkIn.id,
          frequency,
          minuteOfDay,
        );

        if (!schedule) {
          throw new InternalServerError(
            "Failed to update notification schedule.",
          );
        }
      }
    }

    return {
      success: true,
      journey: {
        id: journey.id,
        title: journey.title,
        entries: journey.entries,
      },
    };
  });
