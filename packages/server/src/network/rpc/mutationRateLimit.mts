import { createRateLimiter } from "../../util/rateLimiter.mjs";
import { getLimit } from "../../util/limits.mjs";

/**
 * Per-user cap on mutations (every write: journal entries, journeys,
 * check-ins, chat …), applied to the shared `procedure` so no route can
 * forget it. Defaults: 60 per rolling minute and 1000 per rolling hour,
 * overridable with MUTATION_LIMIT_PER_MINUTE / MUTATION_LIMIT_PER_HOUR
 * (0 disables a window).
 *
 * No released build sends looped or fan-out mutations, so each mutation is
 * one user action; 60 a minute is one action every second for a full minute.
 * Mutations are never retried by the app, so a rejection cannot multiply.
 * Sponsor chat also has its own, stricter limit (chatRateLimit), which still
 * decides chat. In-process only, like every limiter here.
 */
export const MUTATION_RATE_LIMIT_MESSAGE =
  "You're doing that too quickly. Please wait a moment and try again.";

const limiter = createRateLimiter({
  limits: () => [
    { windowMs: 60_000, max: getLimit("MUTATION_LIMIT_PER_MINUTE") },
    { windowMs: 60 * 60_000, max: getLimit("MUTATION_LIMIT_PER_HOUR") },
  ],
  message: MUTATION_RATE_LIMIT_MESSAGE,
});

/** Throws TOO_MANY_REQUESTS when `userId` is over a mutation limit. */
export function consumeMutationRateLimit(
  userId: string,
  now: number = Date.now(),
): void {
  limiter.consume(userId, 1, now);
}

/** Clears all counts. For tests. */
export const resetMutationRateLimits = limiter.reset;
