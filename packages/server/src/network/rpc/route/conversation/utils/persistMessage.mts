import { InternalServerError } from "@onerlaw/framework/backend/rpc";
import type { Context } from "../../../../../context.mjs";
import {
  type ConversationMessageModel,
  type MessageRole,
} from "../../../../../util/database.mjs";

/**
 * Encrypts a message with the conversation DEK and stores it. The single
 * write path for conversation messages, shared by sponsorChat and (later)
 * the streaming procedures, so ordering and encryption cannot drift.
 */
export async function persistMessage(
  ctx: Context,
  userId: string,
  conversationId: string,
  role: MessageRole,
  text: string,
): Promise<ConversationMessageModel> {
  const encrypted = await ctx.service.encryption.encrypt(
    ctx,
    ctx.service.encryption.DEKIdentifier.CONVERSATION,
    text,
  );

  const message = await ctx.database.conversation.addMessage(
    conversationId,
    userId,
    role,
    encrypted,
  );

  if (!message) {
    throw new InternalServerError("Failed to save message.");
  }

  return message;
}
