import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const removeJourneyInput = z.object({
  journeyId: z.string().uuid(),
});

export const remove = procedure
  .input(removeJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const journey = await ctx.database.journey.remove(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!journey) {
      throw new InternalServerError("Failed to remove journey.");
    }

    return {
      success: true,
      journey: {
        id: journey.id,
        title: journey.title,
      },
    };
  });
