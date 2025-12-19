import { type GoogleGenAI } from "@google/genai";
import { type Logger } from "../../util/logger/index.mjs";

export async function chat(
  logger: Logger,
  client: GoogleGenAI,
  prompt: string,
) {
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    logger.error(
      {
        error,
        tags: ["datasource", "gemini", "chat"],
      },
      "Error generating chat response",
    );
    return null;
  }
}
