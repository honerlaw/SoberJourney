import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { MessageRole } from "../../../../util/database.mjs";

const chatInput = z.object({
  conversationId: z.uuid(),
  text: z.string().min(1),
});

export const chat = procedure
  .input(chatInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Get AI response from Gemini
    const aiResponse = await ctx.datasource.gemini.chat(input.text);

    if (!aiResponse) {
      throw new InternalServerError("Failed to generate response.");
    }

    // Add user's message to conversation
    const userMessage = await ctx.database.conversation.addMessage(
      input.conversationId,
      ctx.auth.user.id,
      MessageRole.USER,
      input.text,
    );

    if (!userMessage) {
      throw new NotFoundError("Conversation not found.");
    }

    // Add AI response to conversation
    const modelMessage = await ctx.database.conversation.addMessage(
      input.conversationId,
      ctx.auth.user.id,
      MessageRole.MODEL,
      aiResponse,
    );

    if (!modelMessage) {
      throw new InternalServerError("Failed to save response.");
    }

    return {
      response: aiResponse,
    };
  });
