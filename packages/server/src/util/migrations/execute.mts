import { createContext } from "../../context.mjs";
import { runMigration, type MigrationPrepare } from "./runMigration.mjs";

/**
 * Entry point used by the startup migrations: creates an unauthenticated
 * context and runs the migration once (see `runMigration`). Never rejects.
 */
export async function execute(
  name: string,
  prepare: MigrationPrepare,
): Promise<void> {
  const ctx = await createContext(undefined);
  await runMigration(ctx, name, prepare);
}
