import {
  type ContentListUnion,
  type GenerateContentConfig,
  type GoogleGenAI,
} from "@google/genai";
import { type Logger } from "../../util/logger/index.mjs";
import {
  classifyError,
  classifyOutcome,
  GEMINI_TIMEOUT_MS,
  getDefaultModel,
  logNonOkResult,
  type ChatResult,
  withModelDefaults,
} from "./chat.mjs";

/**
 * Streams a chat response: yields each non-empty text chunk as it arrives and
 * returns the classified result (ok / blocked / truncated) once the stream
 * ends, from the accumulated text and the last block / finish reason seen.
 * Throws `GeminiError` like `chat`.
 *
 * Pass `config.abortSignal` to cancel: an abort is rethrown as-is (it is not
 * a Gemini failure and is not logged as one).
 *
 * The yielded deltas are what the model produced so far; a later chunk can
 * still turn the result into `blocked` (safety) or `truncated` (max tokens),
 * so callers must treat the returned result as authoritative.
 */
export async function* chatStream(
  logger: Logger,
  client: GoogleGenAI,
  contents: ContentListUnion,
  config: GenerateContentConfig = {},
  model: string = getDefaultModel(),
): AsyncGenerator<string, ChatResult, undefined> {
  let text = "";
  let blockReason: string | undefined;
  let finishReason: string | undefined;

  try {
    const stream = await client.models.generateContentStream({
      model,
      contents,
      config: {
        ...withModelDefaults(model, config),
        httpOptions: { timeout: GEMINI_TIMEOUT_MS, ...config.httpOptions },
      },
    });

    for await (const chunk of stream) {
      blockReason = chunk.promptFeedback?.blockReason ?? blockReason;
      finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
      const delta = chunk.text;
      if (delta) {
        text += delta;
        yield delta;
      }
    }

    const result = classifyOutcome({ blockReason, finishReason, text });
    logNonOkResult(logger, model, result, "chatStream");
    return result;
  } catch (error) {
    if (config.abortSignal?.aborted) {
      throw error;
    }
    const geminiError = classifyError(error);
    logger.error(
      {
        error,
        attributes: { model, kind: geminiError.kind },
        tags: ["datasource", "gemini", "chatStream"],
      },
      "Error streaming chat response",
    );
    throw geminiError;
  }
}
