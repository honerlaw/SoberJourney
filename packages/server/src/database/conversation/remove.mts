import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModel } from "../../generated/prisma/models.js";

export async function remove(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
): Promise<ConversationModel | null> {
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
          tags: ["database", "conversation", "remove"],
        },
        "Conversation not found or does not belong to user",
      );
      return null;
    }

    // Delete the conversation (messages will cascade delete)
    const removedConversation = await client.conversation.delete({
      where: {
        id: conversationId,
        userId: userId,
      },
    });

    return removedConversation;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          conversationId,
          userId,
        },
        tags: ["database", "conversation", "remove"],
      },
      "Failed to remove conversation",
    );
    return null;
  }
}
