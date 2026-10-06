import type { Logger } from "../../util/logger/index.mjs";
import type { DBClient } from "../../util/database.mjs";

/**
 * Re-activate a previously revoked push token for the given user. Used when
 * the signed-in user explicitly re-registers the token (e.g. signing back in
 * on the same device after a sign out revoked it). Returns the number of
 * re-activated rows, or null on failure.
 */
export async function reactivatePushToken(
  logger: Logger,
  client: DBClient,
  userId: string,
  token: string,
): Promise<number | null> {
  try {
    const result = await client.userPushToken.updateMany({
      where: { userId, token, revoked: true },
      data: { revoked: false },
    });
    return result.count;
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "user", "reactivatePushToken"] },
      "Failed to reactivate user push token",
    );
    return null;
  }
}
