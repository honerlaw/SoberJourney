import {
  type DBClient,
  type UserJourneyModelWithEntries,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function list(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<UserJourneyModelWithEntries[]> {
  try {
    return await client.userJourney.findMany({
      where: {
        userId,
      },
      include: {
        entries: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "journey", "list"],
      },
      "Failed to list user journeys",
    );
    return [];
  }
}
