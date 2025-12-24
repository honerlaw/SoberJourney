import { execute } from "./execute.mjs";

const MIGRATION_NAME = "encrypt_conversations";

export async function encryptConversations(): Promise<void> {
  await execute(MIGRATION_NAME, async (ctx) => {
    try {
      await ctx.database.client.$transaction(async (tx) => {
        // Fetch all users with their conversations, messages, and encryption keys
        const users = await tx.user.findMany({
          include: {
            conversations: {
              include: {
                messages: true,
              },
            },
            userKey: true,
          },
        });

        for (const user of users) {
          if (user.conversations.length === 0) {
            continue;
          }

          // Encrypt and update each conversation message
          for (const conversation of user.conversations) {
            for (const message of conversation.messages) {
              const userCtx = await ctx.clone(user);
              const encryptedContent = await userCtx.service.encryption.encrypt(
                userCtx,
                userCtx.service.encryption.DEKIdentifier.CONVERSATION,
                message.content,
              );
              await tx.conversationMessage.update({
                where: { id: message.id },
                data: { content: encryptedContent },
              });
            }
          }
        }
      });
    } catch (error) {
      ctx.logger.error(
        { error, tags: ["migration", MIGRATION_NAME] },
        "Failed to encrypt conversations",
      );
      return false;
    }

    return true;
  });
}
