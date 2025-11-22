import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient, type Item, ItemStatus } from "../../util/database.mjs";

export const update = async function (
  logger: Logger,
  client: DBClient,
  userId: string,
  itemId: string,
  status: ItemStatus,
  nextCursor: string | null = null,
): Promise<Item | null> {
  try {
    const data: Parameters<typeof client.item.update>[0]["data"] = { status };
    if (nextCursor !== null) {
      data.nextCursor = nextCursor;
    }

    return await client.item.update({
      where: { userId, itemId },
      data,
    });
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "user", "items", "update"] },
      "Failed to update item",
    );
    return null;
  }
};
