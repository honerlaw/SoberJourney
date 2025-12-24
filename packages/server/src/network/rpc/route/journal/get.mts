import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const getJournalEntryInput = z.object({
  entryId: z.uuid(),
});

export const get = procedure
  .input(getJournalEntryInput)
  .query(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const entry = await ctx.database.journal.get(
      input.entryId,
      ctx.auth.user.id,
    );

    if (!entry) {
      throw new NotFoundError("Journal entry not found.");
    }

    // Decrypt the journal content before returning
    const decryptedContent = await ctx.service.encryption.decrypt(
      ctx,
      ctx.service.encryption.DEKIdentifier.JOURNAL,
      entry.content,
    );

    return {
      entry: {
        id: entry.id,
        content: decryptedContent,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    };
  });
