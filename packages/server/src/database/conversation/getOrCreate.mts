import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModel } from "../../generated/prisma/models.js";

export async function getOrCreate(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<ConversationModel | null> {
  try {
    // Try to find the most recent conversation for the user
    const existingConversation = await client.conversation.findFirst({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    // No existing conversation found, create a new one
    return await client.conversation.create({
      data: {
        userId,
        title: null,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "conversation", "getOrCreate"],
      },
      "Failed to get or create conversation",
    );
    return null;
  }
}
