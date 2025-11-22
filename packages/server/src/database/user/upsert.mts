import { type DBClient, type UserModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

export async function upsert(
  logger: Logger,
  client: DBClient,
  authId: string,
): Promise<UserModel | null> {
  try {
    return await client.user.upsert({
      where: {
        authId: authId,
      },
      create: {
        authId: authId,
      },
      update: {},
    });
  } catch (err) {
    logger.error(
      {
        error: err,
        tags: ["database", "user", "upsert"],
      },
      "Failed to upsert user",
    );
    return null;
  }
}
