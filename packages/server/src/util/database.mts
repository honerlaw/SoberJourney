import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export * from "../generated/prisma/index.js";

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })
const client = new PrismaClient({ adapter })
export type DBClient = typeof client;
