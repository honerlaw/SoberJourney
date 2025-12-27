import type { Logger } from "../../../util/logger/index.mjs";
import type { DBClient } from "../../../util/database.mjs";

export async function upsert(
  logger: Logger,
  client: DBClient,
  userId: string,
  token: string,
) {
  try {
    return await client.userPushToken.upsert({
      where: {
        userId_token: {
          userId,
          token,
        },
      },
      update: {},
      create: { userId, token },
    });
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "user", "pushToken", "upsert"] },
      "Failed to upsert user push token",
    );
    return null;
  }
}
