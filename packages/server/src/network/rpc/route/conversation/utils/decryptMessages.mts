import type { Context } from "../../../../../context.mjs";
import { type ConversationMessageModel } from "../../../../../util/database.mjs";

export type DecryptedMessage = {
  id: string;
  role: ConversationMessageModel["role"];
  content: string;
  createdAt: Date;
};

export async function decryptMessages(
  ctx: Context,
  messages: ConversationMessageModel[],
): Promise<DecryptedMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      id: message.id,
      role: message.role,
      content: await ctx.service.encryption.decrypt(
        ctx,
        ctx.service.encryption.DEKIdentifier.CONVERSATION,
        message.content,
      ),
      createdAt: message.createdAt,
    })),
  );
}
