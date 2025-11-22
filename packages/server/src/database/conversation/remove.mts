import type { Logger } from "../../util/logger/index.mjs";
import type { DBClient } from "../../util/database.mjs";

export async function remove(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
) {
  try {
    return await client.conversation.delete({
      where: {
        openaiConversationId: conversationId,
        userId: userId,
      },
    });
  } catch (error) {
    logger.error(
      {
        error,
        tags: ["database", "conversation", "remove"],
      },
      "Error removing conversation",
    );
    return null;
  }
}
