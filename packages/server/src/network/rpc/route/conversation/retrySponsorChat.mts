import { z } from "zod";
import { procedure } from "../../router.mjs";
import { runRetrySponsorChat } from "./sponsorChat/runRetrySponsorChat.mjs";

// New procedure (no released app calls it). `messageId` is the server id of
// the unanswered user message, as returned by `conversation.get`.
export const retrySponsorChatInput = z.object({
  conversationId: z.uuid(),
  messageId: z.string().min(1).max(200),
});

export const retrySponsorChat = procedure
  .input(retrySponsorChatInput)
  .mutation(async ({ ctx, input }) => runRetrySponsorChat(ctx, input));
