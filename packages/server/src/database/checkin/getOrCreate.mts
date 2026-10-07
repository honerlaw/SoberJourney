import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { type JourneyCheckInModel } from "../../generated/prisma/models.js";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function ownedBy(
  checkIn: JourneyCheckInModel | null,
  userId: string,
): JourneyCheckInModel | null {
  return checkIn && checkIn.userId === userId ? checkIn : null;
}

export async function getOrCreate(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<JourneyCheckInModel | null> {
  try {
    // upsert on the unique journeyId so concurrent calls don't race between
    // a find and a create
    const checkIn = await client.journeyCheckIn.upsert({
      where: {
        journeyId,
      },
      create: {
        journeyId,
        userId,
      },
      update: {},
    });

    return ownedBy(checkIn, userId);
  } catch (err) {
    let error = err;

    // a concurrent create won the race, read the row it created
    if (isUniqueConstraintError(error)) {
      try {
        const existing = await client.journeyCheckIn.findUnique({
          where: {
            journeyId,
          },
        });
        return ownedBy(existing, userId);
      } catch (readErr) {
        error = readErr;
      }
    }

    logger.error(
      {
        error,
        tags: ["database", "checkin", "getOrCreate"],
      },
      "Failed to get or create journey check-in",
    );
    return null;
  }
}
