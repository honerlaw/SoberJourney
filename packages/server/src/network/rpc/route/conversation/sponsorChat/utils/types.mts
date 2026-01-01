import { z } from "zod";
import type {
  JourneyCheckInEntryModel,
  UserJourneyModelWithEntries,
} from "../../../../../../util/database.mjs";

export const chatInput = z.object({
  conversationId: z.uuid(),
  text: z.string().min(1),
});

export type JourneyWithCheckIns = {
  journey: UserJourneyModelWithEntries;
  recentCheckIns: JourneyCheckInEntryModel[];
};
