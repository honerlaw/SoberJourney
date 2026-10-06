import {
  type DBClient,
  type ConversationModel,
  type ConversationMessageModel,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export type MessagesPage = {
  conversation: ConversationModel;
  // chronological (ascending) order
  messages: ConversationMessageModel[];
  // id of the oldest returned message when older messages exist, else null
  nextCursor: string | null;
};

/**
 * Keyset pagination over a conversation's messages, newest page first.
 * Returns the newest `limit` messages strictly older than `cursor` (a message
 * id), in ascending order. A cursor that is not a message of this conversation
 * yields an empty page. Returns null when the conversation does not exist or
 * does not belong to the user.
 */
export async function getMessagesPage(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
  options: { cursor?: string | undefined; limit: number },
): Promise<MessagesPage | null> {
  try {
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      logger.warn(
        {
          attributes: { conversationId, userId },
          tags: ["database", "conversation", "getMessagesPage"],
        },
        "Conversation not found or does not belong to user",
      );
      return null;
    }

    let olderThan: { createdAt: Date; id: string } | null = null;
    if (options.cursor) {
      olderThan = await client.conversationMessage.findFirst({
        where: { id: options.cursor, conversationId },
        select: { createdAt: true, id: true },
      });
      if (!olderThan) {
        return { conversation, messages: [], nextCursor: null };
      }
    }

    const newestFirst = await client.conversationMessage.findMany({
      where: {
        conversationId,
        ...(olderThan
          ? {
              OR: [
                { createdAt: { lt: olderThan.createdAt } },
                { createdAt: olderThan.createdAt, id: { lt: olderThan.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options.limit + 1,
    });

    const hasMore = newestFirst.length > options.limit;
    const page = newestFirst.slice(0, options.limit).reverse();

    return {
      conversation,
      messages: page,
      nextCursor: hasMore && page.length > 0 ? page[0]!.id : null,
    };
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: { conversationId, userId },
        tags: ["database", "conversation", "getMessagesPage"],
      },
      "Failed to get conversation messages page",
    );
    return null;
  }
}
