import type { Logger } from "../../../util/logger/index.mjs";
import type { DBClient } from "../../../util/database.mjs";

export async function update(
  logger: Logger,
  client: DBClient,
  userId: string,
  itemId: string,
  itemTransactionId: string,
  transaction: string,
) {
  try {
    return await client.itemTransaction.update({
      where: { id: itemTransactionId, itemId: itemId, userId: userId },
      data: { transaction },
    });
  } catch (error) {
    logger.error(
      { error, tags: ["database", "items", "transactions", "update"] },
      "Failed to update item transaction",
    );
    return null;
  }
}
