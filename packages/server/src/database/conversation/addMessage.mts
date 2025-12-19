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
    // First verify that the conversation belongs to the user
    const conversation = await client.conversation.findFirst({
      where: {
        id: conversationId,
        userId: userId,
      },
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

    // Create the message and update conversation's updatedAt
    const message = await client.conversationMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    // Update the conversation's updatedAt timestamp
    await client.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
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
