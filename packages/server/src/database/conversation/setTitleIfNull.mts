import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

/**
 * Sets the conversation title only if it is still null (or empty), so a concurrent title
 * generation (or a user rename) is never overwritten. Returns true when the
 * title was written.
 */
export async function setTitleIfNull(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  try {
    const result = await client.conversation.updateMany({
      where: {
        id: conversationId,
        userId,
        OR: [{ title: null }, { title: "" }],
      },
      data: {
        title,
      },
    });

    return result.count > 0;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: { conversationId, userId },
        tags: ["database", "conversation", "setTitleIfNull"],
      },
      "Failed to set conversation title",
    );
    return false;
  }
}
