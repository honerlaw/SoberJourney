import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const updateJourneyInput = z.object({
  journeyId: z.uuid(),
  title: z.string().min(1, "Journey name is required."),
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

    return {
      success: true,
      journey: {
        id: journey.id,
        title: journey.title,
        entries: journey.entries,
      },
    };
  });
