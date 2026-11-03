import type { Context } from "../../context.mjs";
import { createRateLimiter } from "../../util/rateLimiter.mjs";
import { getLimit } from "../../util/limits.mjs";

/**
 * Per-user ceiling on decrypted values: 30,000 per rolling minute by default
 * (DECRYPT_LIMIT_PER_MINUTE, 0 disables). Each value costs a 1000-iteration
 * PBKDF2 on the shared threadpool, so this keeps one account from tying up
 * decryption for everyone. It is a high backstop, not a normal-load limit: a
 * journal entry has one encrypted field, so a full journal.list at the
 * 5,000-entry quota costs 5,000.
 *
 * Callers reserve the whole count before decrypting anything, so a rejected
 * request does no work; a retried 429 costs nothing either. Keyed by the
 * session user (every decrypt is user-scoped). In-process only, like every
 * limiter here.
 */
export const DECRYPT_BUDGET_MESSAGE =
  "Too many requests right now. Please wait a moment and try again.";

const limiter = createRateLimiter({
  limits: () => [
    { windowMs: 60_000, max: getLimit("DECRYPT_LIMIT_PER_MINUTE") },
  ],
  message: DECRYPT_BUDGET_MESSAGE,
});

/**
 * Reserves `count` decrypts for the session user or throws TOO_MANY_REQUESTS.
 * Without a session user nothing is reserved; the key lookup rejects such a
 * call on its own.
 */
export function reserveDecrypts(
  ctx: Context,
  count: number,
  now: number = Date.now(),
): void {
  const userId = ctx.auth?.user?.id;
  if (!userId) {
    return;
  }
  limiter.consume(userId, count, now);
}

/** Clears all counts. For tests. */
export const resetDecryptBudget = limiter.reset;
