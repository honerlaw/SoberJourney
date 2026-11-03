import { initTRPC } from "@trpc/server";
import type { Context } from "../../context.mjs";
import superjson from "superjson";
import { TRPC_OPTIONS } from "./trpcOptions.mjs";
import { formatError } from "./errorFormatter.mjs";
import { isDevelopment } from "../../util/environment.mjs";

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 *
 * `isDev` is explicit: tRPC's own default (NODE_ENV !== "production") would
 * put stack traces in error responses whenever the deploy leaves NODE_ENV
 * unset.
 */
const trpc = initTRPC.context<Context>().create({
  transformer: superjson,
  ...TRPC_OPTIONS,
  isDev: isDevelopment(),
  errorFormatter: formatError,
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = trpc.router;
export const procedure = trpc.procedure;
