import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const removeJournalEntryInput = z.object({
  entryId: z.uuid(),
});

export const remove = procedure
  .input(removeJournalEntryInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const entry = await ctx.database.journal.remove(
      input.entryId,
      ctx.auth.user.id,
    );

    if (!entry) {
      throw new InternalServerError("Failed to remove journal entry.");
    }

    return {
      success: true,
      entry: {
        id: entry.id,
      },
    };
  });
