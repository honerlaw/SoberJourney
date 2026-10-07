import type { Logger } from "../../util/logger/index.mjs";
import type { DBClient } from "../../util/database.mjs";

/**
 * Revoke the given user's push token (e.g. on sign out) so no further
 * notifications are sent to it. Returns the number of revoked rows, or null
 * on failure.
 */
export async function revokePushToken(
  logger: Logger,
  client: DBClient,
  userId: string,
  token: string,
): Promise<number | null> {
  try {
    const result = await client.userPushToken.updateMany({
      where: { userId, token, revoked: false },
      data: { revoked: true },
    });
    return result.count;
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "user", "revokePushToken"] },
      "Failed to revoke user push token",
    );
    return null;
  }
}
