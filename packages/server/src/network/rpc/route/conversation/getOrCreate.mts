import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const getOrCreateConversationInput = z.object({});

export const getOrCreate = procedure
  .input(getOrCreateConversationInput)
  .mutation(async ({ ctx }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const conversation = await ctx.database.conversation.getOrCreate(
      ctx.auth.user.id,
    );

    if (!conversation) {
      throw new Error("Failed to get or create conversation.");
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
