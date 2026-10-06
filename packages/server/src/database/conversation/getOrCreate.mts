import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type ConversationModel } from "../../generated/prisma/models.js";

export async function getOrCreate(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<ConversationModel | null> {
  try {
    return await client.$transaction(async (tx) => {
      // Serialize find-then-create per user so two concurrent calls cannot
      // both miss and create duplicate empty conversations. The advisory lock
      // is released automatically when the transaction ends.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conversation:getOrCreate:${userId}`}))`;

      // Try to find the most recent conversation for the user
      const existingConversation = await tx.conversation.findFirst({
        where: {
          userId,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });

      if (existingConversation) {
        return existingConversation;
      }

      // No existing conversation found, create a new one
      return await tx.conversation.create({
        data: {
          userId,
          title: null,
        },
      });
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
