import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";

export const remove = procedure.mutation(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  // Get all conversations for the user before removing them
  const userConversations = await ctx.database.conversation.list(
    ctx.auth.user.id,
  );

  // Remove all conversations from OpenAI
  if (userConversations && userConversations.length > 0) {
    for (const conversation of userConversations) {
      if (conversation.openaiConversationId) {
        // @todo is this rate limited in anyway?
        await ctx.datasource.openai.conversation.remove(
          conversation.openaiConversationId,
        );
      }
    }
  }

  const removedUser = await ctx.database.user.remove(ctx.auth.user.id);

  if (!removedUser) {
    throw new InternalServerError("User not found or failed to remove.");
  }

  return {
    success: true,
    user: {
      id: removedUser.id,
      createdAt: removedUser.createdAt,
    },
  };
});
