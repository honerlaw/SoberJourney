import {
  type DBClient,
  type UserJourneyModelWithEntries,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function reset(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<UserJourneyModelWithEntries | null> {
  try {
    // First verify that the journey belongs to the user
    const journey = await client.userJourney.findFirst({
      where: {
        id: journeyId,
        userId: userId,
      },
    });

    if (!journey) {
      logger.warn(
        {
          attributes: {
            journeyId,
            userId,
          },
          tags: ["database", "journey", "reset"],
        },
        "Journey not found or does not belong to user",
      );
      return null;
    }

    // Create a new entry for the journey
    return await client.userJourney.update({
      where: {
        id: journeyId,
      },
      data: {
        entries: {
          create: {
            createdAt: new Date(),
          },
        },
      },
      include: {
        entries: true,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          journeyId,
          userId,
        },
        tags: ["database", "journey", "reset"],
      },
      "Failed to reset user journey",
    );
    return null;
  }
}
