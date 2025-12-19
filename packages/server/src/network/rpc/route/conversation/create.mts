import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const createConversationInput = z.object({
  title: z.string().optional(),
});

export const create = procedure
  .input(createConversationInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Check if there's an existing conversation for the user
    const existingConversations = await ctx.database.conversation.list(
      ctx.auth.user.id,
    );

    const existing =
      existingConversations.length > 0 ? existingConversations[0] : null;
    if (existing) {
      return {
        conversation: {
          id: existing.id,
          title: existing.title,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        },
      };
    }

    const conversation = await ctx.database.conversation.create(
      ctx.auth.user.id,
      input.title,
    );

    if (!conversation) {
      throw new Error("Failed to create conversation.");
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
