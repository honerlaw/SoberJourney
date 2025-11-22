import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";

export async function getByItemIdForWebhooks(
  logger: Logger,
  client: DBClient,
  itemId: string,
) {
  try {
    return await client.user.findFirst({
      where: {
        items: {
          some: {
            itemId: itemId,
          },
        },
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "user", "getByItemIdForWebhooks"],
      },
      "Failed to get user by item id for webhooks",
    );
    return null;
  }
}
