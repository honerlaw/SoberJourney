import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function updateTitle(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  try {
    await client.conversation.update({
      where: {
        id: conversationId,
        userId: userId,
      },
      data: {
        title,
      },
    });

    return true;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          conversationId,
          userId,
        },
        tags: ["database", "conversation", "updateTitle"],
      },
      "Failed to update conversation title",
    );
    return false;
  }
}
