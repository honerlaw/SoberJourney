import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModelWithMessages } from "../../util/database.mjs";

export async function get(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
): Promise<ConversationModelWithMessages | null> {
  try {
    const conversation = await client.conversation.findFirst({
      where: {
        id: conversationId,
        userId: userId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      logger.warn(
        {
          attributes: {
            conversationId,
            userId,
          },
          tags: ["database", "conversation", "get"],
        },
        "Conversation not found or does not belong to user",
      );
      return null;
    }

    return conversation;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          conversationId,
          userId,
        },
        tags: ["database", "conversation", "get"],
      },
      "Failed to get conversation",
    );
    return null;
  }
}
