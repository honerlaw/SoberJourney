import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JourneyCheckInEntryModel } from "../../generated/prisma/models.js";

export async function getEntriesByJourneyId(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<JourneyCheckInEntryModel[]> {
  try {
    const checkIn = await client.journeyCheckIn.findUnique({
      where: {
        journeyId,
        userId,
      },
      include: {
        entries: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return checkIn?.entries ?? [];
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "checkin", "getEntriesByJourneyId"],
      },
      "Failed to get check-in entries by journey ID",
    );
    return [];
  }
}
