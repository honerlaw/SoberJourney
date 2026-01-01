import { type Content } from "@google/genai";
import { type Context } from "../../../../../../context.mjs";

const TITLE_SYSTEM_PROMPT =
  "Based on the conversation above, generate a short, concise title (5 words or less) that captures the main topic or theme. The title MUST be positive, hopeful, and supportive - focus on growth, progress, and recovery rather than struggles or negativity. Return only the title, nothing else.";

export async function generateTitle(
  ctx: Context,
  conversationId: string,
  userId: string,
  history: Content[],
  existingTitle: string | null,
): Promise<void> {
  if (existingTitle) {
    return;
  }

  const titleResponse = await ctx.datasource.gemini.chat(history, {
    systemInstruction: TITLE_SYSTEM_PROMPT,
  });

  if (titleResponse) {
    await ctx.database.conversation.updateTitle(
      conversationId,
      userId,
      titleResponse.trim(),
    );
  }
}
