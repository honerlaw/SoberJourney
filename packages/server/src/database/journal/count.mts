import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

/**
 * Number of journal entries the user has, check-in journal entries included.
 * Null when the count fails, so callers can fail open.
 */
export async function count(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<number | null> {
  try {
    return await client.journalEntry.count({ where: { userId } });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journal", "count"],
      },
      "Failed to count journal entries",
    );
    return null;
  }
}
