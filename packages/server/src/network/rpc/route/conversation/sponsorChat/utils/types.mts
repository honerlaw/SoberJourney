import { z } from "zod";
import type {
  JourneyCheckInEntryModel,
  UserJourneyModelWithEntries,
} from "../../../../../../util/database.mjs";

// Maximum message length to prevent excessive API costs (roughly ~4,000 words)
const MAX_MESSAGE_LENGTH = 16000;

// No prompt-injection token stripping: Gemini receives user text as a
// structured `role: "user"` part, so other models' chat-template tokens
// (<|im_start|>, [[SYSTEM]], <<SYS>>) have no special meaning, and stripping
// them silently deleted legitimate text such as "<<draft>>" or "[[note]]".
const normalizeInput = (text: string): string => text.trim();

export const chatInput = z.object({
  conversationId: z.uuid(),
  text: z
    .string()
    .min(1, "Message cannot be empty")
    .max(
      MAX_MESSAGE_LENGTH,
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    )
    .transform(normalizeInput)
    .refine((text) => text.length > 0, {
      message: "Message cannot be empty",
    }),
});

export type JourneyWithCheckIns = {
  journey: UserJourneyModelWithEntries;
  recentCheckIns: JourneyCheckInEntryModel[];
};
