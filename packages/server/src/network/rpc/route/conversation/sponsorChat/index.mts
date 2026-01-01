import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { type Content } from "@google/genai";
import { procedure } from "../../../router.mjs";
import { MessageRole } from "../../../../../util/database.mjs";
import { chatInput, type JourneyWithCheckIns } from "./types.mjs";
import { BASE_SYSTEM_PROMPT } from "./systemPrompt.mjs";
import { buildJourneyContext } from "./buildJourneyContext.mjs";

export const sponsorChat = procedure
  .input(chatInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Fetch the conversation and user's journeys in parallel
    const [conversation, journeys] = await Promise.all([
      ctx.database.conversation.get(input.conversationId, ctx.auth.user.id),
      ctx.database.journey.list(ctx.auth.user.id),
    ]);

    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }

    // Fetch recent check-in entries for each journey in parallel
    const journeysWithCheckIns: JourneyWithCheckIns[] = await Promise.all(
      journeys.map(async (journey) => ({
        journey,
        recentCheckIns: await ctx.database.checkin
          .getEntriesByJourneyId(journey.id, ctx.auth.user!.id)
          .then((entries) => entries.slice(0, 5)), // Limit to 5 most recent
      })),
    );

    // Build the system prompt with journey and check-in context
    const journeyContext = buildJourneyContext(journeysWithCheckIns);
    const systemPrompt = BASE_SYSTEM_PROMPT + journeyContext;

    // Decrypt existing messages and convert to Gemini format
    const history: Content[] = await Promise.all(
      conversation.messages.map(async (message) => ({
        role: message.role === MessageRole.USER ? "user" : ("model" as const),
        parts: [
          {
            text: await ctx.service.encryption.decrypt(
              ctx,
              ctx.service.encryption.DEKIdentifier.CONVERSATION,
              message.content,
            ),
          },
        ],
      })),
    );

    // Add the new user message to the history
    history.push({
      role: "user",
      parts: [{ text: input.text }],
    });

    // Get AI response from Gemini with full conversation history
    const aiResponse = await ctx.datasource.gemini.chat(history, {
      systemInstruction: systemPrompt,
    });

    if (!aiResponse) {
      throw new InternalServerError("Failed to generate response.");
    }

    // Encrypt and add user's message to conversation
    const encryptedUserMessage = await ctx.service.encryption.encrypt(
      ctx,
      ctx.service.encryption.DEKIdentifier.CONVERSATION,
      input.text,
    );
    const userMessage = await ctx.database.conversation.addMessage(
      input.conversationId,
      ctx.auth.user.id,
      MessageRole.USER,
      encryptedUserMessage,
    );

    if (!userMessage) {
      throw new InternalServerError("Failed to save user message.");
    }

    // Encrypt and add AI response to conversation
    const encryptedAiResponse = await ctx.service.encryption.encrypt(
      ctx,
      ctx.service.encryption.DEKIdentifier.CONVERSATION,
      aiResponse,
    );
    const modelMessage = await ctx.database.conversation.addMessage(
      input.conversationId,
      ctx.auth.user.id,
      MessageRole.MODEL,
      encryptedAiResponse,
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
