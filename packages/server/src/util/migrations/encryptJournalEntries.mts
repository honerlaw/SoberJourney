import { execute } from "./execute.mjs";

const MIGRATION_NAME = "encrypt_journal_entries";

export async function encryptJournalEntries(): Promise<void> {
  await execute(MIGRATION_NAME, async (ctx) => {
    try {
      await ctx.database.client.$transaction(async (tx) => {
        // Fetch all users with their journal entries and encryption keys
        const users = await tx.user.findMany({
          include: {
            journalEntries: true,
            userKey: true,
          },
        });

        for (const user of users) {
          if (user.journalEntries.length === 0) {
            continue;
          }

          // Encrypt and update each journal entry
          for (const entry of user.journalEntries) {
            const userCtx = await ctx.clone(user);
            const encryptedContent = await userCtx.service.encryption.encrypt(
              userCtx,
              userCtx.service.encryption.DEKIdentifier.JOURNAL,
              entry.content,
            );
            await tx.journalEntry.update({
              where: { id: entry.id },
              data: { content: encryptedContent },
            });
          }
        }
      });
    } catch (error) {
      ctx.logger.error(
        { error, tags: ["migration", MIGRATION_NAME] },
        "Failed to encrypt journals",
      );
      return false;
    }

    return true;
  });
}
