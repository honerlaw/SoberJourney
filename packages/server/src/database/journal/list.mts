import { type DBClient, type JournalEntryModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function list(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<JournalEntryModel[]> {
  try {
    return await client.journalEntry.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journal", "list"],
      },
      "Failed to list journal entries",
    );
    return [];
  }
}
