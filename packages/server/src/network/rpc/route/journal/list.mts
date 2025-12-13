import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";

export const list = procedure.query(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  const entries = await ctx.database.journal.list(ctx.auth.user.id);

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
    })),
  };
});
