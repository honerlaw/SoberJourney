import {
  type DBClient,
  type UserJourneyModelWithEntries,
} from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function create(
  logger: Logger,
  client: DBClient,
  userId: string,
  title: string,
  startDateTime: Date,
): Promise<UserJourneyModelWithEntries | null> {
  try {
    return await client.userJourney.create({
      data: {
        title,
        userId,
        entries: {
          create: {
            createdAt: startDateTime,
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
        tags: ["database", "journey", "create"],
      },
      "Failed to create user journey",
    );
    return null;
  }
}
