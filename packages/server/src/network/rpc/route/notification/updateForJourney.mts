import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { UserPushNotificationScheduleFrequency } from "../../../../generated/prisma/enums.js";

const settingsSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum([
    UserPushNotificationScheduleFrequency.DAILY,
    UserPushNotificationScheduleFrequency.WEEKLY,
    UserPushNotificationScheduleFrequency.BIWEEKLY,
    UserPushNotificationScheduleFrequency.MONTHLY,
  ]),
  minuteOfDay: z.number().min(0).max(1439), // 0-1439 (24 hours * 60 minutes - 1)
});

const updateForJourneyInput = z.object({
  journeyId: z.string().min(1, "Journey ID is required."),
  settings: settingsSchema,
});

export const updateForJourney = procedure
  .input(updateForJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Verify the journey belongs to the user
    const journey = await ctx.database.journey.get(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!journey) {
      throw new NotFoundError("Journey not found.");
    }

    const { settings } = input;

    // If disabling notifications
    if (!settings.enabled) {
      // Get the check-in for this journey
      const checkIn = await ctx.database.checkin.getByJourneyId(
        input.journeyId,
        ctx.auth.user.id,
      );

      // If there's a check-in, remove its notification schedule
      if (checkIn) {
        await ctx.database.notification.schedule.remove(checkIn.id);
      }

      return {
        success: true,
        notificationSettings: {
          enabled: false,
          frequency: settings.frequency,
          minuteOfDay: settings.minuteOfDay,
        },
      };
    }

    // If enabling notifications, get or create the check-in
    const checkIn = await ctx.database.checkin.getOrCreate(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!checkIn) {
      throw new InternalServerError("Failed to get or create check-in.");
    }

    // Create or update the notification schedule
    const schedule = await ctx.database.notification.schedule.upsert(
      ctx.auth.user.id,
      checkIn.id,
      settings.frequency,
      settings.minuteOfDay,
    );

    if (!schedule) {
      throw new InternalServerError("Failed to update notification schedule.");
    }

    return {
      success: true,
      settings: {
        enabled: true,
        frequency: schedule.frequency,
        minuteOfDay: schedule.minuteOfDay ?? 480,
      },
    };
  });
