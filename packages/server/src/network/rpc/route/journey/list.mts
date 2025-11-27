import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";

export const list = procedure.query(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  const journeys = await ctx.database.journey.list(ctx.auth.user.id);

  return {
    success: true,
    journeys: journeys.map((journey) => ({
      id: journey.id,
      title: journey.title,
      entryCount: journey.entries.length,
      lastEntry: journey.entries[0]
        ? {
            id: journey.entries[0].id,
            createdAt: journey.entries[0].createdAt,
          }
        : null,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
    })),
  };
});
