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

  // Plaid integration
  PLAID_CLIENT_ID: z.string().min(1, "PLAID_CLIENT_ID is required"),
  PLAID_SECRET: z.string().min(1, "PLAID_SECRET is required"),
  PLAID_SECRET_SANDBOX: z.string().min(1, "PLAID_SECRET_SANDBOX is required"),

  // Encryption
  KEY_ENCRYPTION_KEY: z.string().min(1, "KEY_ENCRYPTION_KEY is required"),

  // Database (assuming DATABASE_URL is used by Prisma, even if not directly referenced)
  DATABASE_URL: z.string().url().optional(),

  // OpenAI (based on test script mentioning OPENAI_API_KEY)
  OPENAI_API_KEY: z.string().min(1).optional(),

  // Webhook base URL
  WEBHOOK_BASE_URL: z.string().min(1, "WEBHOOK_BASE_URL is required"),
});

export type Config = z.infer<typeof envSchema>;

let cachedConfig: Config | null = null;

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
    logger.error(
      {
        error,
        tags: ["util", "config"],
        attributes: {
          key,
          expectedValue: envSchema.shape[key],
          value: process.env[key],
          defaultValue,
        },
      },
      "Error getting config",
    );
    throw new Error("Failed to get config.");
  }
}
