import { type DBClient, type UserModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";

const DEFAULT_TIMEZONE = "America/New_York";

export async function upsert(
  logger: Logger,
  client: DBClient,
  authId: string,
  timezone?: string,
): Promise<UserModel | null> {
  const userTimezone = timezone || DEFAULT_TIMEZONE;
  try {
    return await client.user.upsert({
      where: {
        authId: authId,
      },
      create: {
        authId: authId,
        timezone: userTimezone,
      },
      update: {
        timezone: userTimezone,
      },
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
