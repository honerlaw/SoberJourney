import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";

export async function getByConversationIdForUser(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
) {
  try {
    return await client.conversation.findUnique({
      where: {
        openaiConversationId: conversationId,
        userId,
      },
    });
  } catch (error) {
    logger.error(
      {
        error,
        tags: ["database", "conversation", "getByConversationIdForUser"],
      },
      "Error getting conversation by id for user",
    );
    return null;
  }
}
