import type { Logger } from "../../../util/logger/index.mjs";
import type { DBClient } from "../../../util/database.mjs";

/**
 * Register a push token for a user.
 *
 * A push token identifies a device install, so a token registered for this
 * user is revoked for every other user (shared device: user B signing in must
 * stop user A's reminders on that device). Released apps never call a revoke
 * route, so this server-side step is their only protection.
 *
 * Re-registering re-enables a previously revoked token for this user: the app
 * only registers after notification permission is granted and it obtained a
 * fresh token from Expo, so the device is live for this user again.
 */
export async function upsert(
  logger: Logger,
  client: DBClient,
  userId: string,
  token: string,
) {
  try {
    return await client.$transaction(async (tx) => {
      await tx.userPushToken.updateMany({
        where: {
          token,
          userId: {
            not: userId,
          },
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      return tx.userPushToken.upsert({
        where: {
          userId_token: {
            userId,
            token,
          },
        },
        update: {
          revoked: false,
        },
        create: { userId, token },
      });
    });
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "notification", "pushToken", "upsert"] },
      "Failed to upsert user push token",
    );
    return null;
  }
}
