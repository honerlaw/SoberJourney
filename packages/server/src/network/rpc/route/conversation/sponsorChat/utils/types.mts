import { z } from "zod";
import type {
  JourneyCheckInEntryModel,
  UserJourneyModelWithEntries,
} from "../../../../../../util/database.mjs";

// Maximum message length to prevent excessive API costs (roughly ~4,000 words)
const MAX_MESSAGE_LENGTH = 16000;

// Patterns that could be used for prompt injection attacks
const SPECIAL_TOKEN_PATTERNS = [
  /<\|[\w_]+\|>/gi, // Tokens like <|im_start|>, <|endoftext|>, <|system|>
  /\[\[[\w_]+\]\]/gi, // Tokens like [[SYSTEM]], [[USER]]
  /<<[\w_]+>>/gi, // Tokens like <<SYS>>, <<INST>>
];

/**
 * Sanitizes user input by removing potential prompt injection tokens
 */
const sanitizeInput = (text: string): string => {
  let sanitized = text;
  for (const pattern of SPECIAL_TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized.trim();
};

export const chatInput = z.object({
  conversationId: z.uuid(),
  text: z
    .string()
    .min(1, "Message cannot be empty")
    .max(
      MAX_MESSAGE_LENGTH,
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    )
    .transform(sanitizeInput)
    .refine((text) => text.length > 0, {
      message: "Message cannot be empty after sanitization",
    }),
});

export type JourneyWithCheckIns = {
  journey: UserJourneyModelWithEntries;
  recentCheckIns: JourneyCheckInEntryModel[];
};
