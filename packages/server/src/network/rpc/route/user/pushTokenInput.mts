import { z } from "zod";

// generous bound, expo push tokens are ~41 characters
const MAX_PUSH_TOKEN_LENGTH = 4096;

export const pushTokenInput = z.object({
  token: z
    .string()
    .min(1, "Push token is required.")
    .max(MAX_PUSH_TOKEN_LENGTH, "Push token is too long."),
});
