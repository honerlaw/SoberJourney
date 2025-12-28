import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JourneyCheckInEntryModel } from "../../generated/prisma/models.js";
import { type CheckInMood } from "../../generated/prisma/enums.js";

export async function createEntry(
  logger: Logger,
  client: DBClient,
  checkInId: string,
  mood: CheckInMood,
  urge: number,
): Promise<JourneyCheckInEntryModel | null> {
  try {
    return await client.journeyCheckInEntry.create({
      data: {
        checkInId,
        mood,
        urge,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "checkin", "createEntry"],
      },
      "Failed to create journey check-in entry",
    );
    return null;
  }
}
