import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

export const RENAME_TITLE_MAX_LENGTH = 100;

/**
 * Single line, collapsed whitespace, trimmed, capped at a word boundary.
 * Returns "" when nothing is left.
 */
export function normalizeRenameTitle(raw: string): string {
  let title = raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (title.length > RENAME_TITLE_MAX_LENGTH) {
    const cut = title.slice(0, RENAME_TITLE_MAX_LENGTH);
    const lastSpace = cut.lastIndexOf(" ");
    title = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
  }

  return title;
}

// A new procedure: no released app sends it, so an empty title may be
// rejected. Over-long titles are clamped rather than rejected.
export const renameConversationInput = z.object({
  conversationId: z.uuid(),
  title: z
    .string()
    .max(10_000)
    .transform(normalizeRenameTitle)
    .refine((title) => title.length > 0, {
      message: "Title cannot be empty",
    }),
});

export const rename = procedure
  .input(renameConversationInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const conversation = await ctx.database.conversation.rename(
      input.conversationId,
      ctx.auth.user.id,
      input.title,
    );

    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }

    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  });
