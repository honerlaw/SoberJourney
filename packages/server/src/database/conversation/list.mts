import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";

export async function list(logger: Logger, client: DBClient, userId: string) {
  try {
    return await client.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  } catch (error) {
    logger.error(
      {
        error,
        tags: ["database", "conversation", "list"],
      },
      "Error listing conversations",
    );
  }
}
