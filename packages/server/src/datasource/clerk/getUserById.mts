import { type ClerkClient } from "@clerk/express";
import { type Logger } from "../../util/logger/index.mjs";

export async function getUserById(
  logger: Logger,
  client: ClerkClient,
  userId: string,
) {
  try {
    return await client.users.getUser(userId);
  } catch (error) {
    logger.error(
      {
        error,
        tags: ["datasource", "clerk", "getUserById"],
      },
      "Error getting user by id",
    );
    return null;
  }
}
