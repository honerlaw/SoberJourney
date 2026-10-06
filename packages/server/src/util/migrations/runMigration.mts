import type { Context } from "../../context.mjs";
import type { Prisma } from "../../generated/prisma/client.js";

export type MigrationTx = Prisma.TransactionClient;

/** A single write, applied inside the migration's transaction. */
export type MigrationWrite = (tx: MigrationTx) => Promise<unknown>;

/**
 * Prepares a migration outside of any transaction (reads, key lookups and the
 * CPU heavy work such as encryption) and returns the writes to apply, or
 * `false` to abort without recording the migration.
 */
export type MigrationPrepare = (
  ctx: Context,
) => Promise<MigrationWrite[] | false>;

// the writes are cheap single-row updates, but give large tables headroom
// over prisma's 5s interactive transaction default
const TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;
const TRANSACTION_MAX_WAIT_MS = 30 * 1000;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Runs a data migration at most once.
 *
 * 1. Skip if the `Migration` marker already exists.
 * 2. `prepare` runs outside any transaction, so no connection is held while
 *    keys are resolved / data is encrypted.
 * 3. One transaction applies the writes. The marker is inserted FIRST: a
 *    concurrent migrator blocks on the unique index until the winner commits,
 *    then fails with P2002 and rolls back without touching any rows. Marker and
 *    data commit (or roll back) together, so a crash can never leave data
 *    migrated without its marker (which would double-apply on next boot).
 *
 * Never rejects: startup awaits all migrations before listening, so failures
 * are logged and swallowed (the migration is retried on the next boot).
 *
 * @returns true if this call applied the migration
 */
export async function runMigration(
  ctx: Context,
  name: string,
  prepare: MigrationPrepare,
): Promise<boolean> {
  const tags = ["migration", name];
  try {
    const found = await ctx.database.client.migration.findUnique({
      where: { name },
    });

    // it exists, so the migration ran
    if (found !== null) {
      return false;
    }

    const writes = await prepare(ctx);

    // if it failed, don't save the migration in the database
    if (writes === false) {
      ctx.logger.warn({ tags }, "Migration failed, not saving to database");
      return false;
    }

    await ctx.database.client.$transaction(
      async (tx) => {
        await tx.migration.create({ data: { name } });
        for (const write of writes) {
          await write(tx);
        }
      },
      {
        timeout: TRANSACTION_TIMEOUT_MS,
        maxWait: TRANSACTION_MAX_WAIT_MS,
      },
    );

    ctx.logger.info({ tags }, "Migration applied");
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      ctx.logger.info(
        { tags },
        "Migration already applied by another instance, skipping",
      );
      return false;
    }

    ctx.logger.error({ error, tags }, "Failed to execute migration");
    return false;
  }
}
