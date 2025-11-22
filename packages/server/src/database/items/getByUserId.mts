import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient, type Item } from "../../util/database.mjs";

export const getByUserId = async function (
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<Item[] | null> {
  try {
    return await client.item.findMany({
      where: { userId },
    });
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "user", "items", "getItems"] },
      "Failed to get items",
    );
    return null;
  }
};
