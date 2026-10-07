import { type DBClient, type ConversationModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export type ConversationsPage = {
  conversations: ConversationModel[];
  // opaque cursor for the next page when more exist, else null
  nextCursor: string | null;
};

type Position = { updatedAt: Date; id: string };

// The cursor carries the (updatedAt, id) of the last row itself, because a
// conversation's updatedAt changes whenever a message is added; looking the
// position up by id at request time would reset or skip pages.
function encodeCursor(position: Position): string {
  return Buffer.from(
    `${position.updatedAt.toISOString()}|${position.id}`,
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string): Position | null {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const separator = decoded.indexOf("|");
  if (separator <= 0) {
    return null;
  }
  const updatedAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(updatedAt.getTime()) || !id) {
    return null;
  }
  return { updatedAt, id };
}

/**
 * Keyset pagination over a user's conversations, most recently updated first
 * (same order as `list`). An unreadable cursor yields an empty page. Returns
 * null on a database error.
 */
export async function listPage(
  logger: Logger,
  client: DBClient,
  userId: string,
  options: { cursor?: string | undefined; limit: number },
): Promise<ConversationsPage | null> {
  let after: Position | null = null;
  if (options.cursor !== undefined) {
    after = decodeCursor(options.cursor);
    if (!after) {
      return { conversations: [], nextCursor: null };
    }
  }

  try {
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
    const last = page[page.length - 1];

    return {
      conversations: page,
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "conversation", "listPage"],
      },
      "Failed to list conversations page",
    );
    return null;
  }
}
