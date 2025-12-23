import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { type Content } from "@google/genai";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { MessageRole } from "../../../../util/database.mjs";

const chatInput = z.object({
  conversationId: z.uuid(),
  text: z.string().min(1),
});

const SYSTEM_PROMPT = `You are a supportive sobriety sponsor. Your role is to provide guidance, encouragement, and accountability to someone on their recovery journey.

Guidelines:
- Keep your responses short and to the point. Be concise and direct.
- When offering suggestions, actions, or options, limit them to 3 at most.
- Do not recommend hotlines or crisis resources unless the user explicitly indicates they are in crisis or asks for them.
- Be empathetic, non-judgmental, and supportive in your tone.
- Focus on practical, actionable advice rooted in recovery principles.

When the user is struggling or feels at risk of relapse:
- Be their immediate support. Don't just recommend they reach out to others—offer to be there for them right now.
- If they feel like they might act out or break their sobriety, engage them directly: ask how they're feeling, what triggered this moment, and what's going through their mind.
- Help distract them by keeping the conversation going. Ask follow-up questions, explore their feelings, or shift to grounding topics if helpful.
- Validate that reaching out here counts as reaching out—they don't need someone else to talk to if no one is available.
- Remind them that cravings and urges are temporary, and staying present in this conversation can help them ride it out.
- If appropriate, guide them through simple coping techniques like deep breathing, playing the tape forward, or listing reasons they chose sobriety.`;

export const sponsorChat = procedure
  .input(chatInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Fetch the conversation with all existing messages
    const conversation = await ctx.database.conversation.get(
      input.conversationId,
      ctx.auth.user.id,
    );

    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }

    // Convert existing messages to Gemini format
    const history: Content[] = conversation.messages.map((message) => ({
      role: message.role === MessageRole.USER ? "user" : "model",
      parts: [{ text: message.content }],
    }));

    // Add the new user message to the history
    history.push({
      role: "user",
      parts: [{ text: input.text }],
    });

    // Get AI response from Gemini with full conversation history
    const aiResponse = await ctx.datasource.gemini.chat(history, {
      systemInstruction: SYSTEM_PROMPT,
    });

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
      throw new InternalServerError("Failed to save user message.");
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

    // Generate a title for the conversation if one doesn't exist
    if (!conversation.title) {
      const titleResponse = await ctx.datasource.gemini.chat(
        [
          {
            role: "user",
            parts: [{ text: input.text }],
          },
        ],
        {
          systemInstruction:
            "Generate a short, concise title (5 words or less) for a conversation that starts with the following message. Return only the title, nothing else.",
        },
      );

      if (titleResponse) {
        await ctx.database.conversation.updateTitle(
          input.conversationId,
          ctx.auth.user.id,
          titleResponse.trim(),
        );
      }
    }

    return {
      response: aiResponse,
    };
  });
