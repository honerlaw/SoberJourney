import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JournalEntryModel } from "../../generated/prisma/models.js";

export async function remove(
  logger: Logger,
  client: DBClient,
  entryId: string,
  userId: string,
): Promise<JournalEntryModel | null> {
  try {
    // First verify that the journal entry belongs to the user
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
          tags: ["database", "journal", "remove"],
        },
        "Journal entry not found or does not belong to user",
      );
      return null;
    }

    // Delete the journal entry
    const removedEntry = await client.journalEntry.delete({
      where: {
        id: entryId,
        userId: userId,
      },
    });

    return removedEntry;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          entryId,
          userId,
        },
        tags: ["database", "journal", "remove"],
      },
      "Failed to remove journal entry",
    );
    return null;
  }
}
