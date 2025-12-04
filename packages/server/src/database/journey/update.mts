import {
  type DBClient,
  type UserJourneyModelWithEntries,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function update(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
  title: string,
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
          tags: ["database", "journey", "update"],
        },
        "Journey not found or does not belong to user",
      );
      return null;
    }

    // Update the journey title
    return await client.userJourney.update({
      where: {
        id: journey.id,
        userId,
      },
      data: {
        title,
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
        tags: ["database", "journey", "update"],
      },
      "Failed to update user journey",
    );
    return null;
  }
}
