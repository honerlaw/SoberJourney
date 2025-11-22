import { PrismaClient } from "../generated/prisma/index.js";

export * from "../generated/prisma/index.js";

export const client = new PrismaClient();

export type DBClient = typeof client;
