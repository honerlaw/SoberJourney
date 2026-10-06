import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { UserPushNotificationScheduleFrequency } from "../../../../generated/prisma/enums.js";
import { journeyTitleSchema, startDateTimeSchema } from "./inputs.mjs";

const notificationSettingsSchema = z.object({
  frequency: z.enum([
    UserPushNotificationScheduleFrequency.DAILY,
    UserPushNotificationScheduleFrequency.WEEKLY,
    UserPushNotificationScheduleFrequency.BIWEEKLY,
    UserPushNotificationScheduleFrequency.MONTHLY,
  ]),
  minuteOfDay: z.number().min(0).max(1439), // 0-1439 (24 hours * 60 minutes - 1)
});

export const createJourneyInput = z.object({
  title: journeyTitleSchema,
  startDateTime: startDateTimeSchema,
  notificationSettings: notificationSettingsSchema.optional(),
});

export const create = procedure
  .input(createJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // creates the journey, its first entry and (optionally) the check-in +
    // notification schedule in a single atomic statement
    const journey = await ctx.database.journey.create(
      ctx.auth.user.id,
      input.title,
      input.startDateTime,
      input.notificationSettings,
    );

    if (!journey) {
      throw new InternalServerError("Failed to create journey.");
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
