import type { Logger } from "../../../util/logger/index.mjs";
import type { DBClient } from "../../../util/database.mjs";

export async function upsert(
  logger: Logger,
  client: DBClient,
  userId: string,
  key: string,
) {
  try {
    return await client.userKey.upsert({
      where: { userId },
      update: {},
      create: { userId, key },
    });
  } catch (err) {
    logger.error(
      { error: err, tags: ["database", "user", "key", "upsert"] },
      "Failed to upsert user key",
    );
    return null;
  }
}
