import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JournalEntryModel } from "../../generated/prisma/models.js";

export async function create(
  logger: Logger,
  client: DBClient,
  userId: string,
  content: string,
  checkInId?: string | null,
): Promise<JournalEntryModel | null> {
  try {
    return await client.journalEntry.create({
      data: {
        userId,
        content,
        checkInId: checkInId ?? null,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journal", "create"],
      },
      "Failed to create journal entry",
    );
    return null;
  }
}
