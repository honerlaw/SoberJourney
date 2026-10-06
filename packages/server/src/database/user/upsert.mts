import { type DBClient, type UserModel } from "../../util/database.mjs";
import { type Logger } from "../../util/logger/index.mjs";
import { isValidTimeZone } from "./isValidTimeZone.mjs";

const DEFAULT_TIMEZONE = "America/New_York";

export async function upsert(
  logger: Logger,
  client: DBClient,
  authId: string,
  timezone?: string,
): Promise<UserModel | null> {
  // an invalid / missing timezone never overwrites the stored one, new users
  // fall back to the default
  const validTimezone = isValidTimeZone(timezone) ? timezone : undefined;
  try {
    return await client.user.upsert({
      where: {
        authId: authId,
      },
      create: {
        authId: authId,
        timezone: validTimezone ?? DEFAULT_TIMEZONE,
      },
      update: validTimezone ? { timezone: validTimezone } : {},
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
