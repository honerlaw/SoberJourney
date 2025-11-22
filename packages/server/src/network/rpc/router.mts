import { initTRPC } from "@trpc/server";
import type { Context } from "../../context.mjs";
import superjson from "superjson";

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const trpc = initTRPC.context<Context>().create({
  transformer: superjson,
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = trpc.router;
export const procedure = trpc.procedure;
