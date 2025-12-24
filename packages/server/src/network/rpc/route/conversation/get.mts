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

    // Decrypt all message contents
    const decryptedMessages = await Promise.all(
      conversation.messages.map(async (message) => ({
        id: message.id,
        role: message.role,
        content: await ctx.service.encryption.decrypt(
          ctx,
          ctx.service.encryption.DEKIdentifier.CONVERSATION,
          message.content,
        ),
        createdAt: message.createdAt,
      })),
    );

    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: decryptedMessages,
      },
    };
  });
