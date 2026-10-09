import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { buildPgConfig } from "./databaseConfig.mjs";

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

// DATABASE_CA_CERT (optional PEM) turns on verified TLS; see databaseConfig.mts
const adapter = new PrismaPg(buildPgConfig(process.env));
export const client = new PrismaClient({ adapter });
export type DBClient = typeof client;
