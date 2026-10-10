import { OpenAI, type ClientOptions } from "openai";
import { LLM_TIMEOUT_MS, OPENROUTER_BASE_URL } from "./chat.mjs";

/**
 * OpenAI SDK options for OpenRouter's OpenAI-compatible API. No automatic
 * retries: a turn holds the conversation lock for the whole call, and a
 * failed turn keeps the user's message for a manual retry.
 */
export function clientOptions(apiKey: string): ClientOptions {
  return {
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: LLM_TIMEOUT_MS,
    maxRetries: 0,
    // OpenRouter app attribution.
    defaultHeaders: {
      "HTTP-Referer": "https://soberjourney.app",
      "X-OpenRouter-Title": "SoberJourney",
    },
  };
}

/**
 * The OpenRouter client, or null without an API key: the server still boots
 * and every chat call fails with LlmError("unavailable").
 */
export function createClient(apiKey: string | undefined): OpenAI | null {
  return apiKey ? new OpenAI(clientOptions(apiKey)) : null;
}
