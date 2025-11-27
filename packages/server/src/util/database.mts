import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

import {
  type UserJourneyModel,
  type UserJourneyEntryModel,
} from "../generated/prisma/models.js";

export type UserJourneyModelWithEntries = UserJourneyModel & {
  entries: UserJourneyEntryModel[];
};

export * from "../generated/prisma/models.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
export const client = new PrismaClient({ adapter });
export type DBClient = typeof client;
