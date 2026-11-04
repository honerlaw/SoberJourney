import { initTRPC } from "@trpc/server";
import type { Context } from "../../context.mjs";
import superjson from "superjson";
import { TRPC_OPTIONS } from "./trpcOptions.mjs";
import { formatError } from "./errorFormatter.mjs";
import { isDevelopment } from "../../util/environment.mjs";
import { consumeMutationRateLimit } from "./mutationRateLimit.mjs";

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
 * Counts every mutation by a signed-in user against the per-user mutation
 * limit. Runs before input parsing and the route itself; unauthenticated
 * calls pass through to the route's own auth check.
 */
const mutationRateLimit = trpc.middleware(({ ctx, type, next }) => {
  const userId = ctx.auth?.user?.id;
  if (type === "mutation" && userId) {
    consumeMutationRateLimit(userId);
  }
  return next();
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = trpc.router;
export const procedure = trpc.procedure.use(mutationRateLimit);
