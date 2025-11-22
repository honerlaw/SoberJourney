import type { Logger } from "../../../util/logger/index.mjs";
import type { DBClient } from "../../../util/database.mjs";

export async function remove(
  logger: Logger,
  client: DBClient,
  userId: string,
  itemId: string,
  itemTransactionId: string,
) {
  try {
    return await client.itemTransaction.delete({
      where: {
        id: itemTransactionId,
        itemId: itemId,
        userId: userId,
      },
    });
  } catch (error) {
    logger.error(
      { error, tags: ["database", "items", "transactions", "remove"] },
      "Failed to remove item transaction",
    );
    return null;
  }
}
