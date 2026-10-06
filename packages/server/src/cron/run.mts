import type { Context } from "../context.mjs";

// generous upper bound for one cron run; the lock is released when the
// transaction ends (or its connection closes if the process dies)
const LOCK_TRANSACTION_TIMEOUT_MS = 15 * 60 * 1000;
const LOCK_TRANSACTION_MAX_WAIT_MS = 30 * 1000;

export type RunResult = "ran" | "skipped" | "failed";

export type LockedWork = (assertLockHeld: () => Promise<void>) => Promise<void>;

/**
 * Run `work` while holding a Postgres transaction-level advisory lock, so
 * overlapping cron runs never send twice. The lock lives in a Prisma
 * interactive transaction; the work itself uses the normal connection pool
 * (so the pool needs at least 2 connections). `assertLockHeld` throws if the
 * lock transaction has ended (timeout, killed connection), and is checked
 * right before sending.
 *
 * @returns "ran" if the work completed, "skipped" if another run holds the
 * lock, "failed" if acquiring the lock or the work threw (logged)
 */
export async function runWithLock(
  ctx: Context,
  work: LockedWork,
): Promise<RunResult> {
  let acquired = false;

  try {
    await ctx.database.client.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('soberjourney:cron:notifications')) AS locked
        `;

        if (!rows[0]?.locked) {
          ctx.logger.warn(
            { tags: ["cron", "lock"] },
            "Another cron run holds the lock, skipping this run",
          );
          return;
        }

        acquired = true;
        await work(async () => {
          await tx.$queryRaw`SELECT 1`;
        });
      },
      {
        timeout: LOCK_TRANSACTION_TIMEOUT_MS,
        maxWait: LOCK_TRANSACTION_MAX_WAIT_MS,
      },
    );
  } catch (error) {
    ctx.logger.error({ error, tags: ["cron", "lock"] }, "Cron run failed");
    return "failed";
  }

  return acquired ? "ran" : "skipped";
}
