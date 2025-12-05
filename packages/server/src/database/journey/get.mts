import {
  type DBClient,
  type UserJourneyModelWithEntries,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function get(
  logger: Logger,
  client: DBClient,
  journeyId: string,
  userId: string,
): Promise<UserJourneyModelWithEntries | null> {
  try {
    return await client.userJourney.findUnique({
      where: {
        id: journeyId,
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
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journey", "get"],
      },
      "Failed to get user journey",
    );
    return null;
  }
}
