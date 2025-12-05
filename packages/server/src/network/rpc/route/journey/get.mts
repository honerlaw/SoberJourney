import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const getJourneyInput = z.object({
  journeyId: z.uuid(),
});

export const get = procedure
  .input(getJourneyInput)
  .query(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const journey = await ctx.database.journey.get(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!journey) {
      throw new NotFoundError("Journey not found.");
    }

    return {
      success: true,
      journey: {
        id: journey.id,
        title: journey.title,
        position: journey.position,
        entries: journey.entries.map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
        })),
        createdAt: journey.createdAt,
        updatedAt: journey.updatedAt,
      },
    };
  });
