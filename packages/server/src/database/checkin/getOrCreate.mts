import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JourneyCheckInModel } from "../../generated/prisma/models.js";

export async function getOrCreate(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<JourneyCheckInModel | null> {
  try {
    // Try to find existing check-in first
    const existing = await client.journeyCheckIn.findUnique({
      where: {
        journeyId,
        userId,
      },
    });

    if (existing) {
      return existing;
    }

    // Create a new check-in if none exists
    return await client.journeyCheckIn.create({
      data: {
        journeyId,
        userId,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "checkin", "getOrCreate"],
      },
      "Failed to get or create journey check-in",
    );
    return null;
  }
}
