import { createContext, type Context } from "../../context.mjs";

export async function execute(
  name: string,
  callback: (ctx: Context) => Promise<boolean>,
): Promise<void> {
  const ctx = await createContext(undefined);
  try {
    const found = await ctx.database.client.migration.findUnique({
      where: {
        name,
      },
    });

    // it exists, so the migration ran
    if (found !== null) {
      return;
    }

    const result = await callback(ctx);

    // if it failed, don't save the migration in the database
    if (!result) {
      ctx.logger.warn(
        { tags: ["migration", name] },
        "Migration failed, not saving to database",
      );
      return;
    }

    // otherwise persist the change to the database
    await ctx.database.client.migration.create({
      data: {
        name,
      },
    });
  } catch (error) {
    ctx.logger.error(
      { error, tags: ["migration", name] },
      "Failed to execute migration",
    );
  }
}
