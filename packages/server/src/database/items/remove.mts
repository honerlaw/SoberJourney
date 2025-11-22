import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";

export async function remove(
  logger: Logger,
  client: DBClient,
  userId: string,
  itemId: string,
) {
  try {
    return await client.item.delete({
      where: { itemId, userId },
    });
  } catch (error) {
    logger.error(
      { error, tags: ["database", "items", "remove"] },
      "Failed to remove item",
    );
    return null;
  }
}
