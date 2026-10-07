import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { withConversationLock } from "./utils/conversationLock.mjs";

const removeConversationInput = z.object({
  conversationId: z.uuid(),
});

export const remove = procedure
  .input(removeConversationInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }
    const userId = ctx.auth.user.id;

    // Wait (bounded) for an in-flight chat turn so a delete does not race it.
    // database remove() returns null both when the conversation is missing /
    // not owned and on a database error; both surface as NotFound.
    const conversation = await withConversationLock(input.conversationId, () =>
      ctx.database.conversation.remove(input.conversationId, userId),
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
