import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const getNotificationSettingsInput = z.object({
  journeyId: z.string().min(1, "Journey ID is required."),
});

export const getNotificationSettings = procedure
  .input(getNotificationSettingsInput)
  .query(async ({ ctx, input }) => {
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

    // Get the check-in for this journey (if it exists)
    const checkIn = await ctx.database.checkin.getByJourneyId(
      input.journeyId,
      ctx.auth.user.id,
    );

    // If no check-in exists, return disabled notification settings
    if (!checkIn) {
      return {
        success: true,
        notificationSettings: {
          enabled: false,
          frequency: "DAILY" as const,
          minuteOfDay: 480, // 8:00 AM default
        },
      };
    }

    // Get the notification schedule for this check-in
    const schedule = await ctx.database.notification.schedule.getByCheckInId(
      checkIn.id,
    );

    // If no schedule exists, return disabled notification settings
    if (!schedule) {
      return {
        success: true,
        notificationSettings: {
          enabled: false,
          frequency: "DAILY" as const,
          minuteOfDay: 480, // 8:00 AM default
        },
      };
    }

    return {
      success: true,
      notificationSettings: {
        enabled: true,
        frequency: schedule.frequency,
        minuteOfDay: schedule.minuteOfDay ?? 480,
      },
    };
  });
