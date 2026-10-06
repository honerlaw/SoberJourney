import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JourneyCheckInEntryModel } from "../../generated/prisma/models.js";

/**
 * Returns the newest `limit` check-in entries for a journey the user owns.
 *
 * Lives under database/conversation because it only serves the sponsor chat's
 * context and database/checkin is owned by another audit bucket (#27) this
 * wave; it can move to database/checkin later.
 */
export async function getRecentCheckInEntries(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
  limit: number,
): Promise<JourneyCheckInEntryModel[]> {
  try {
    return await client.journeyCheckInEntry.findMany({
      where: {
        checkIn: {
          journeyId,
          userId,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: { journeyId, userId },
        tags: ["database", "conversation", "getRecentCheckInEntries"],
      },
      "Failed to get recent check-in entries",
    );
    return [];
  }
}
