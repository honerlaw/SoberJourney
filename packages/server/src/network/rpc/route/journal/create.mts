import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const createJournalEntryInput = z.object({
  content: z.string().min(1, "Journal entry content is required."),
});

export const create = procedure
  .input(createJournalEntryInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const entry = await ctx.database.journal.create(
      ctx.auth.user.id,
      input.content,
    );

    if (!entry) {
      throw new InternalServerError("Failed to create journal entry.");
    }

    return {
      success: true,
      entry: {
        id: entry.id,
        content: entry.content,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    };
  });

