import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const createJourneyInput = z.object({
  title: z.string().min(1, "Journey name is required."),
  startDateTime: z.date(),
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

    return {
      success: true,
      journey: {
        id: journey.id,
        title: journey.title,
        entries: journey.entries,
      },
    };
  });
