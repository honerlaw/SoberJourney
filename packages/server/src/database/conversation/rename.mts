import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModel } from "../../generated/prisma/models.js";

/**
 * Sets a user-chosen title. Returns the updated conversation, or null when it
 * does not exist / does not belong to the user, or on a database error.
 *
 * Written with a raw UPDATE so Prisma's `@updatedAt` is not bumped: renaming
 * is not activity, so it must not reorder the drawer (ordered by updatedAt)
 * or move a row across a `listPage` cursor. A Prisma `update` with an
 * explicit `updatedAt: existing.updatedAt` would need a read-then-write that
 * can overwrite a concurrent message's updatedAt touch with a stale value.
 *
 * Auto-generated titles never overwrite a rename: they are written only by
 * `setTitleIfNull`, which skips any conversation whose title is non-empty,
 * and a rename always stores a non-empty title.
 */
export async function rename(
  logger: Logger,
  client: DBClient,
  conversationId: string,
  userId: string,
  title: string,
): Promise<ConversationModel | null> {
  try {
    const updated = await client.$executeRaw`UPDATE "Conversation" SET "title" = ${title} WHERE "id" = ${conversationId} AND "userId" = ${userId}`;

    if (updated === 0) {
      logger.warn(
        {
          attributes: { conversationId, userId },
          tags: ["database", "conversation", "rename"],
        },
        "Conversation not found or does not belong to user",
      );
      return null;
    }

    return await client.conversation.findFirst({
      where: { id: conversationId, userId },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: { conversationId, userId },
        tags: ["database", "conversation", "rename"],
      },
      "Failed to rename conversation",
    );
    return null;
  }
}
