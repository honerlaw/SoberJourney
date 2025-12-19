import { GoogleGenAI } from "@google/genai";
import { getConfig } from "../../util/config.mjs";

const API_KEY = await getConfig("GEMINI_API_KEY");

export const geminiClient = new GoogleGenAI({
  apiKey: API_KEY,
});
