import { type Context } from "../../../../../../context.mjs";

const TITLE_SYSTEM_PROMPT =
  "You are a title generator. Your only job is to create short, concise titles (5 words or less). The title MUST be positive, hopeful, and supportive - focus on growth, progress, and recovery rather than struggles or negativity. Return ONLY the title text, nothing else. No quotes, no explanation, no punctuation at the end.";

export async function generateTitle(
  ctx: Context,
  conversationId: string,
  userId: string,
  messageText: string,
  existingTitle: string | null,
): Promise<void> {
  if (existingTitle) {
    return;
  }

  const titleResponse = await ctx.datasource.gemini.chat(
    [
      {
        role: "user",
        parts: [
          {
            text: `Generate a title for this message:\n\n${messageText}`,
          },
        ],
      },
    ],
    {
      systemInstruction: TITLE_SYSTEM_PROMPT,
    },
  );

  if (titleResponse) {
    await ctx.database.conversation.updateTitle(
      conversationId,
      userId,
      titleResponse.trim(),
    );
  }
}
