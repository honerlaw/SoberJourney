import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModel } from "../../generated/prisma/models.js";

export async function list(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<ConversationModel[]> {
  try {
    return await client.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "conversation", "list"],
      },
      "Failed to list conversations",
    );
    return [];
  }
}
