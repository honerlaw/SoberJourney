import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

import {
  type UserJourneyModel,
  type UserJourneyEntryModel,
  type ConversationModel,
  type ConversationMessageModel,
} from "../generated/prisma/models.js";

export type UserJourneyModelWithEntries = UserJourneyModel & {
  entries: UserJourneyEntryModel[];
};

export type ConversationModelWithMessages = ConversationModel & {
  messages: ConversationMessageModel[];
};

export * from "../generated/prisma/models.js";
export * from "../generated/prisma/enums.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
export const client = new PrismaClient({ adapter });
export type DBClient = typeof client;
