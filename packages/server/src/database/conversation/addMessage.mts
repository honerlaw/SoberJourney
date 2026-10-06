import {
  type DBClient,
  type ConversationMessageModel,
  MessageRole,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function addMessage(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
  role: MessageRole,
  content: string,
): Promise<ConversationMessageModel | null> {
  try {
    // Ownership check, message insert and the conversation's updatedAt touch
    // commit together, so a message row never exists alongside a reported failure.
    return await client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: {
          id: conversationId,
          userId: userId,
        },
        select: { id: true },
      });

      if (!conversation) {
        logger.warn(
          {
            attributes: {
              conversationId,
              userId,
            },
            tags: ["database", "conversation", "addMessage"],
          },
          "Conversation not found or does not belong to user",
        );
        return null;
      }

      const message = await tx.conversationMessage.create({
        data: {
          conversationId,
          role,
          content,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          conversationId,
          userId,
          role,
        },
        tags: ["database", "conversation", "addMessage"],
      },
      "Failed to add message to conversation",
    );
    return null;
  }
}
