import { type DBClient, type ConversationModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export type ConversationsPage = {
  conversations: ConversationModel[];
  // id of the last returned conversation when more exist, else null
  nextCursor: string | null;
};

/**
 * Keyset pagination over a user's conversations, most recently updated first
 * (same order as `list`). A cursor that is not one of the user's conversations
 * yields an empty page.
 */
export async function listPage(
  logger: Logger,
  client: DBClient,
  userId: string,
  options: { cursor?: string | undefined; limit: number },
): Promise<ConversationsPage> {
  try {
    let after: { updatedAt: Date; id: string } | null = null;
    if (options.cursor) {
      after = await client.conversation.findFirst({
        where: { id: options.cursor, userId },
        select: { updatedAt: true, id: true },
      });
      if (!after) {
        return { conversations: [], nextCursor: null };
      }
    }

    const rows = await client.conversation.findMany({
      where: {
        userId,
        ...(after
          ? {
              OR: [
                { updatedAt: { lt: after.updatedAt } },
                { updatedAt: after.updatedAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const page = rows.slice(0, options.limit);

    return {
      conversations: page,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
    };
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "conversation", "listPage"],
      },
      "Failed to list conversations page",
    );
    return { conversations: [], nextCursor: null };
  }
}
