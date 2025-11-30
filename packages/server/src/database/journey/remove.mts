import { type DBClient, type UserJourneyModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function remove(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<UserJourneyModel | null> {
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
          tags: ["database", "journey", "remove"],
        },
        "Journey not found or does not belong to user",
      );
      return null;
    }

    // Delete the journey (cascade will handle entries)
    const removedJourney = await client.userJourney.delete({
      where: {
        id: journeyId,
        userId: userId,
      },
    });

    return removedJourney;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          journeyId,
          userId,
        },
        tags: ["database", "journey", "remove"],
      },
      "Failed to remove user journey",
    );
    return null;
  }
}
