import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const getConversationInput = z.object({
  conversationId: z.uuid(),
});

export const get = procedure
  .input(getConversationInput)
  .query(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const conversation = await ctx.database.conversation.get(
      input.conversationId,
      ctx.auth.user.id,
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
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
      },
    };
  });
