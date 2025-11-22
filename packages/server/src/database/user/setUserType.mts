import { type Logger } from "../../util/logger/index.mjs";
import { type DBClient } from "../../util/database.mjs";
import { UserType } from "../../generated/prisma/index.js";

export async function setUserType(
  logger: Logger,
  client: DBClient,
  userId: string,
  userType: UserType,
) {
  try {
    await client.user.update({
      where: { id: userId },
      data: { userType },
    });
  } catch (error) {
    logger.error(
      { error, tags: ["database", "user", "setUserType"] },
      "Failed to set user type",
    );
    return null;
  }
}
