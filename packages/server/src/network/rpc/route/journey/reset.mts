import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const resetJourneyInput = z.object({
  journeyId: z.uuid(),
});

export const reset = procedure
  .input(resetJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const journey = await ctx.database.journey.reset(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!journey) {
      throw new InternalServerError("Failed to reset journey.");
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
