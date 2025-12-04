import { type DBClient } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export type ReorderItem = {
  id: string;
  position: number;
};

export async function reorder(
  logger: Logger,
  client: DBClient,
  userId: string,
  items: ReorderItem[],
): Promise<boolean> {
  try {
    // Use a transaction to update all positions atomically
    await client.$transaction(
      items.map((item) =>
        client.userJourney.updateMany({
          where: {
            id: item.id,
            userId: userId,
          },
          data: {
            position: item.position,
          },
        }),
      ),
    );

    return true;
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: {
          userId,
          itemCount: items.length,
        },
        tags: ["database", "journey", "reorder"],
      },
      "Failed to reorder user journeys",
    );
    return false;
  }
}
