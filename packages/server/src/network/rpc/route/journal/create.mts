import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

// generous bound, released apps have no limit on the journal input (the
// request body is already capped at 100kb by express.json)
export const MAX_JOURNAL_CONTENT_LENGTH = 100_000;

export const createJournalEntryInput = z.object({
  content: z
    .string()
    .min(1, "Journal entry content is required.")
    .max(MAX_JOURNAL_CONTENT_LENGTH, "Journal entry is too long."),
});

export const create = procedure
  .input(createJournalEntryInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Encrypt the journal content before storing
    const encryptedContent = await ctx.service.encryption.encrypt(
      ctx,
      ctx.service.encryption.DEKIdentifier.JOURNAL,
      input.content,
    );

    const entry = await ctx.database.journal.create(
      ctx.auth.user.id,
      encryptedContent,
    );

    if (!entry) {
      throw new InternalServerError("Failed to create journal entry.");
    }

    return {
      success: true,
      entry: {
        id: entry.id,
        content: input.content, // Return the original unencrypted content
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    };
  });
