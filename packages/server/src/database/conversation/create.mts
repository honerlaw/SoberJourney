import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModel } from "../../generated/prisma/models.js";

export async function create(
  logger: Logger,
  client: DBClient,
  userId: string,
  title?: string,
): Promise<ConversationModel | null> {
  try {
    return await client.conversation.create({
      data: {
        userId,
        title: title ?? null,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "conversation", "create"],
      },
      "Failed to create conversation",
    );
    return null;
  }
}
