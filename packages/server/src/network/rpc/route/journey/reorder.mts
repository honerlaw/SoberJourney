import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const reorderJourneyInput = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      position: z.number().int().min(0),
    }),
  ),
});

export const reorder = procedure
  .input(reorderJourneyInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const success = await ctx.database.journey.reorder(
      ctx.auth.user.id,
      input.items,
    );

    if (!success) {
      throw new InternalServerError("Failed to reorder journeys.");
    }

    return {
      success: true,
    };
  });
