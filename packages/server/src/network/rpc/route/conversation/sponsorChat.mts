import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { type Content } from "@google/genai";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import {
  CheckInMood,
  MessageRole,
  type JourneyCheckInEntryModel,
  type UserJourneyModelWithEntries,
} from "../../../../util/database.mjs";

const chatInput = z.object({
  conversationId: z.uuid(),
  text: z.string().min(1),
});

const BASE_SYSTEM_PROMPT = `You are a supportive sobriety sponsor. Your role is to provide guidance, encouragement, and accountability to someone on their recovery journey.

Guidelines:
- Keep your responses short and to the point. Be concise and direct.
- When offering suggestions, actions, or options, limit them to 3 at most.
- Do not recommend hotlines or crisis resources unless the user explicitly indicates they are in crisis or asks for them.
- Be empathetic, non-judgmental, and supportive in your tone.
- Focus on practical, actionable advice rooted in recovery principles.

When the user is struggling or feels at risk of relapse:
- Be their immediate support. Don't just recommend they reach out to others—offer to be there for them right now.
- If they feel like they might act out or break their sobriety, engage them directly: ask how they're feeling, what triggered this moment, and what's going through their mind.
- IMPORTANT: When urges are present, immediately offer a specific action or distraction they can do RIGHT NOW. Examples include:
  - Box breathing: Breathe in for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat 4 times.
  - 4-7-8 breathing: Inhale through the nose for 4 counts, hold for 7, exhale slowly through the mouth for 8.
  - Physical grounding: Hold ice cubes, do 10 jumping jacks, splash cold water on the face.
  - Sensory grounding: Name 5 things they can see, 4 they can hear, 3 they can touch, 2 they can smell, 1 they can taste.
  - Simple physical tasks: Take a short walk, do some stretches, or change rooms.
- After offering a technique, ALWAYS follow up with questions to keep them engaged. Ask if they tried it, how it felt, what they're experiencing now, or what else might help.
- Help distract them by keeping the conversation going. Continue asking follow-up questions, explore their feelings, or shift to grounding topics if helpful.
- Validate that reaching out here counts as reaching out—they don't need someone else to talk to if no one is available.
- Remind them that cravings and urges are temporary, and staying present in this conversation can help them ride it out.
- If appropriate, guide them through additional coping techniques like playing the tape forward or listing reasons they chose sobriety.`;

function formatDuration(startDate: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? "just started" : `${diffMinutes} minutes`;
    }
    return diffHours === 1 ? "1 hour" : `${diffHours} hours`;
  }
  if (diffDays === 1) return "1 day";
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.floor(diffDays / 365);
  const remainingMonths = Math.floor((diffDays % 365) / 30);
  if (remainingMonths === 0) {
    return years === 1 ? "1 year" : `${years} years`;
  }
  return `${years} year${years > 1 ? "s" : ""} and ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`;
}

function formatMood(mood: CheckInMood): string {
  switch (mood) {
    case CheckInMood.SAD:
      return "sad";
    case CheckInMood.TIRED:
      return "tired";
    case CheckInMood.NEUTRAL:
      return "neutral";
    case CheckInMood.GOOD:
      return "good";
    case CheckInMood.GREAT:
      return "great";
    default:
      return "unknown";
  }
}

function formatUrge(urge: number): string {
  if (urge <= 1) return "none";
  if (urge <= 2) return "mild";
  if (urge <= 3) return "moderate";
  if (urge <= 4) return "strong";
  return "intense";
}

function formatCheckInAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

type JourneyWithCheckIns = {
  journey: UserJourneyModelWithEntries;
  recentCheckIns: JourneyCheckInEntryModel[];
};

function buildJourneyContext(journeysWithCheckIns: JourneyWithCheckIns[]): string {
  if (journeysWithCheckIns.length === 0) {
    return "";
  }

  const journeyDescriptions = journeysWithCheckIns.map(({ journey, recentCheckIns }) => {
    // The most recent entry represents the current streak start date
    const latestEntry = journey.entries[0];
    const duration = latestEntry ? formatDuration(latestEntry.createdAt) : "just started";
    
    let description = `- ${journey.title}: ${duration}`;
    
    // Add recent check-in context if available
    if (recentCheckIns.length > 0) {
      const latestCheckIn = recentCheckIns[0];
      if (latestCheckIn) {
        const age = formatCheckInAge(latestCheckIn.createdAt);
        const mood = formatMood(latestCheckIn.mood);
        const urge = formatUrge(latestCheckIn.urge);
        description += `\n  Recent check-in (${age}): mood is ${mood}, urge level is ${urge}`;
        
        // If there are multiple recent check-ins, show a brief trend
        if (recentCheckIns.length >= 2) {
          const moods = recentCheckIns.slice(0, 3).map(c => formatMood(c.mood));
          const urges = recentCheckIns.slice(0, 3).map(c => c.urge);
          const avgUrge = urges.reduce((a, b) => a + b, 0) / urges.length;
          description += `\n  Recent pattern: moods have been ${moods.join(" → ")}, avg urge level ${formatUrge(avgUrge)}`;
        }
      }
    }
    
    return description;
  });

  return `

User's Current Sobriety Journeys:
${journeyDescriptions.join("\n")}

Use this information to provide personalized support. Acknowledge their progress when appropriate, and be mindful of which specific journeys they're working on. Pay attention to their recent check-in data - if they've reported high urges or negative moods recently, be especially supportive and proactive in offering coping strategies.`;
}

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
        recentCheckIns: await ctx.database.checkin.getEntriesByJourneyId(
          journey.id,
          ctx.auth.user!.id,
        ).then(entries => entries.slice(0, 5)), // Limit to 5 most recent
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
