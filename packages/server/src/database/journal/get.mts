import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JournalEntryModel } from "../../generated/prisma/models.js";

export async function get(
  logger: Logger,
  client: DBClient,
  entryId: string,
  userId: string,
): Promise<JournalEntryModel | null> {
  try {
    const entry = await client.journalEntry.findFirst({
      where: {
        id: entryId,
        userId: userId,
      },
    });

    if (!entry) {
      logger.warn(
        {
          attributes: {
            entryId,
            userId,
          },
          tags: ["database", "journal", "get"],
        },
        "Journal entry not found or does not belong to user",
      );
      return null;
    }

    return entry;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          entryId,
          userId,
        },
        tags: ["database", "journal", "get"],
      },
      "Failed to get journal entry",
    );
    return null;
  }
}
