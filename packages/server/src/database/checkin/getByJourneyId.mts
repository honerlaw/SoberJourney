import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JourneyCheckInModel } from "../../generated/prisma/models.js";

export async function getByJourneyId(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<JourneyCheckInModel | null> {
  try {
    return await client.journeyCheckIn.findUnique({
      where: {
        journeyId,
        userId,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "checkin", "getByJourneyId"],
      },
      "Failed to get journey check-in",
    );
    return null;
  }
}
