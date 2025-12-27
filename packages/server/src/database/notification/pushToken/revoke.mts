import { type DBClient } from "../../../util/database.mjs";
import { type Logger } from "../../../util/logger/index.mjs";
import { type UserPushTokenModel } from "../../../generated/prisma/models.js";

/**
 * Revoke a push token (mark it as revoked)
 */
export async function revoke(
  logger: Logger,
  client: DBClient,
  pushTokenId: string,
): Promise<UserPushTokenModel | null> {
  try {
    return await client.userPushToken.update({
      where: {
        id: pushTokenId,
      },
      data: {
        revoked: true,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        attributes: { pushTokenId },
        tags: ["database", "notification", "pushToken", "revoke"],
      },
      "Failed to revoke push token",
    );
    return null;
  }
}
