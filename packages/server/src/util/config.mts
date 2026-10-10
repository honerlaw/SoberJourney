import { logger } from "./logger/index.mjs";
import { z } from "zod";

const envSchema = z.object({
  // Server configuration
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Clerk authentication
  CLERK_JWSK: z.string().min(1, "CLERK_JWSK is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),

  // Encryption
  KEY_ENCRYPTION_KEY: z.string().min(1, "KEY_ENCRYPTION_KEY is required"),

  // Database (assuming DATABASE_URL is used by Prisma, even if not directly referenced)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // OpenRouter (LLM). Optional so a deploy without it still boots: only
  // Sponsor chat replies fail (see datasource/openrouter/client.mts).
  OPENROUTER_API_KEY: z.string().min(1).optional(),

  // comma-separated apex hosts that are redirected to their www. subdomain
  REDIRECT_APEX_HOSTS: z.string().default("soberjourney.app"),
});

export type Config = z.infer<typeof envSchema>;

let cachedConfig: Config | null = null;

/**
 * Summarize validation issues without any input values.
 */
export function describeIssues(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    }));
  }
  return [{ message: error instanceof Error ? error.name : "Unknown error" }];
}

// async so that we can back this with async operations in the future easily
// e.g. if we fetch from secret manager directly instead
export async function getConfig<Key extends keyof Config>(
  key: Key,
  defaultValue?: Config[Key],
): Promise<Config[Key]> {
  if (cachedConfig) {
    return cachedConfig[key];
  }

  try {
    cachedConfig = await envSchema.parseAsync(process.env);
    return cachedConfig[key];
  } catch (error) {
    // on error, if there is a default value, use it
    // as we only error if we fail to load the config
    if (typeof defaultValue !== "undefined") {
      return defaultValue;
    }
    // never log env values (or defaults), they may contain secrets
    logger.error(
      {
        tags: ["util", "config"],
        attributes: {
          key,
          issues: describeIssues(error),
        },
      },
      "Error getting config",
    );
    throw new Error("Failed to get config.");
  }
}
