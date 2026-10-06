import type { Context } from "../../context.mjs";
import type { MigrationWrite } from "./runMigration.mjs";

/**
 * Encrypts every journal entry with its owner's JOURNAL DEK. Runs outside the
 * migration transaction; one ctx per user so the DEK is resolved once per user.
 */
export async function prepareEncryptJournalEntries(
  ctx: Context,
): Promise<MigrationWrite[]> {
  const users = await ctx.database.client.user.findMany({
    include: { journalEntries: true },
  });

  const writes: MigrationWrite[] = [];
  for (const user of users) {
    if (user.journalEntries.length === 0) {
      continue;
    }

    const userCtx = await ctx.clone(user);
    for (const entry of user.journalEntries) {
      const content = await userCtx.service.encryption.encrypt(
        userCtx,
        userCtx.service.encryption.DEKIdentifier.JOURNAL,
        entry.content,
      );
      writes.push((tx) =>
        // only if the row still holds the plaintext we encrypted, so a
        // concurrent edit is never overwritten with stale content
        tx.journalEntry.updateMany({
          where: { id: entry.id, content: entry.content },
          data: { content },
        }),
      );
    }
  }

  return writes;
}

/**
 * Encrypts every conversation message with its owner's CONVERSATION DEK. Runs
 * outside the migration transaction; one ctx per user so the DEK is resolved
 * once per user.
 */
export async function prepareEncryptConversations(
  ctx: Context,
): Promise<MigrationWrite[]> {
  const users = await ctx.database.client.user.findMany({
    include: { conversations: { include: { messages: true } } },
  });

  const writes: MigrationWrite[] = [];
  for (const user of users) {
    if (user.conversations.length === 0) {
      continue;
    }

    const userCtx = await ctx.clone(user);
    for (const conversation of user.conversations) {
      for (const message of conversation.messages) {
        const content = await userCtx.service.encryption.encrypt(
          userCtx,
          userCtx.service.encryption.DEKIdentifier.CONVERSATION,
          message.content,
        );
        writes.push((tx) =>
          // only if the row still holds the plaintext we encrypted
          tx.conversationMessage.updateMany({
            where: { id: message.id, content: message.content },
            data: { content },
          }),
        );
      }
    }
  }

  return writes;
}
