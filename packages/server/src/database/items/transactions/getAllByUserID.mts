import type { Logger } from "../../../util/logger/index.mjs";
import type { DBClient, ItemTransaction } from "../../../util/database.mjs";

export async function getAllByUserID(
  logger: Logger,
  client: DBClient,
  userId: string,
): Promise<ItemTransaction[] | null> {
  try {
    return await client.itemTransaction.findMany({
      where: { userId },
    });
  } catch (error) {
    logger.error(
      { error, tags: ["database", "items", "transactions", "getAll"] },
      "Failed to get all item transactions",
    );
    return null;
  }
}
