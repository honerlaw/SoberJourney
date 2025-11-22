import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";

export async function update(
  logger: Logger,
  client: DBClient,
  userId: string,
  conversationId: string,
  title: string,
) {
  try {
    return await client.conversation.update({
      where: {
        userId,
        openaiConversationId: conversationId,
      },
      data: {
        title,
      },
    });
  } catch (error) {
    logger.error(
      {
        error,
        tags: ["database", "conversation", "update"],
      },
      "Error updating conversation",
    );
    return null;
  }
}
