import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushTokenModel } from "../../../generated/prisma/models.js";

/**
 * Get all non-revoked push tokens
 */
export async function list(
  logger: Logger,
  client: DBClient,
): Promise<UserPushTokenModel[]> {
  try {
    return await client.userPushToken.findMany({
      where: {
        revoked: false,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "notification", "pushToken", "list"],
      },
      "Failed to list push tokens",
    );
    return [];
  }
}
