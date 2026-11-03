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
  // one budget reservation for the whole list, before any decryption
  const contents = await ctx.service.encryption.decryptMany(
    ctx,
    ctx.service.encryption.DEKIdentifier.CONVERSATION,
    messages.map((message) => message.content),
  );
  return messages.map((message, index) => ({
    id: message.id,
    role: message.role,
    content: contents[index]!,
    createdAt: message.createdAt,
  }));
}
