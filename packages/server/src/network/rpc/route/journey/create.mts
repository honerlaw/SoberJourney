import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { UserPushNotificationScheduleFrequency } from "../../../../generated/prisma/enums.js";

const notificationSettingsSchema = z.object({
  frequency: z.enum([
    UserPushNotificationScheduleFrequency.DAILY,
    UserPushNotificationScheduleFrequency.WEEKLY,
    UserPushNotificationScheduleFrequency.BIWEEKLY,
    UserPushNotificationScheduleFrequency.MONTHLY,
  ]),
  minuteOfDay: z.number().min(0).max(1439), // 0-1439 (24 hours * 60 minutes - 1)
});

const createJourneyInput = z.object({
  title: z.string().min(1, "Journey name is required."),
  startDateTime: z.date(),
  notificationSettings: notificationSettingsSchema.optional(),
});

export const create = procedure
  .input(createJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const journey = await ctx.database.journey.create(
      ctx.auth.user.id,
      input.title,
      input.startDateTime,
    );

    if (!journey) {
      throw new InternalServerError("Failed to create journey.");
    }

    // If notification settings are provided, create a check-in and notification schedule
    if (input.notificationSettings) {
      // Get or create a check-in for this journey
      const checkIn = await ctx.database.checkin.getOrCreate(
        journey.id,
        ctx.auth.user.id,
      );

      if (!checkIn) {
        throw new InternalServerError(
          "Failed to create check-in for notifications.",
        );
      }

      // Create the notification schedule
      const schedule = await ctx.database.notification.schedule.upsert(
        ctx.auth.user.id,
        checkIn.id,
        input.notificationSettings.frequency,
        input.notificationSettings.minuteOfDay,
      );

      if (!schedule) {
        throw new InternalServerError(
          "Failed to create notification schedule.",
        );
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
