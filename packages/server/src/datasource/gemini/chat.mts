import {
  type ContentListUnion,
  type GenerateContentConfig,
  type GoogleGenAI,
} from "@google/genai";
import { type Logger } from "../../util/logger/index.mjs";

export async function chat(
  logger: Logger,
  client: GoogleGenAI,
  contents: ContentListUnion,
  config: GenerateContentConfig = {},
  model: string = "gemini-2.0-flash",
) {
  try {
    const response = await client.models.generateContent({
      model,
      contents,
      config,
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
