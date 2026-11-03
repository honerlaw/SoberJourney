import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

/** Number of journeys the user has. Null when the count fails (fail open). */
export async function count(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<number | null> {
  try {
    return await client.userJourney.count({ where: { userId } });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journey", "count"],
      },
      "Failed to count user journeys",
    );
    return null;
  }
}
