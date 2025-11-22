import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";

export async function remove(logger: Logger, client: DBClient, userId: string) {
  try {
    const removedUser = await client.user.delete({
      where: {
        id: userId,
      },
    });

    return removedUser;
  } catch (error) {
    logger.error({ error, tags: ["database", "user", "remove"] });
    return null;
  }
}
