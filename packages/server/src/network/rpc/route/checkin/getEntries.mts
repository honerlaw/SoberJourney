import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const getEntriesInput = z.object({
  journeyId: z.string().min(1, "Journey ID is required."),
});

/**
 * Returns all check-in entries for a journey.
 */
export const getEntries = procedure
  .input(getEntriesInput)
  .query(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const entries = await ctx.database.checkin.getEntriesByJourneyId(
      input.journeyId,
      ctx.auth.user.id,
    );

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        mood: entry.mood,
        urge: entry.urge,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    };
  });
