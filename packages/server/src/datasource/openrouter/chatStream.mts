import { type OpenAI } from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { type Logger } from "../../util/logger/index.mjs";
import {
  blockedResultForError,
  bodyError,
  buildParams,
  classifyError,
  classifyOutcome,
  LLM_TIMEOUT_MS,
  LlmError,
  logFallback,
  logLlmError,
  logNonOkResult,
  missingKeyError,
  type ChatRequest,
  type ChatResult,
  type OpenRouterStreamParams,
} from "./chat.mjs";

type ChunkWithExtras = ChatCompletionChunk & {
  error?: unknown;
  choices: Array<
    ChatCompletionChunk["choices"][number] & {
      native_finish_reason?: string | null;
    }
  >;
};

/**
 * Streams a chat response: yields each non-empty text chunk as it arrives and
 * returns the classified result (ok / blocked / truncated) once the stream
 * ends, from the accumulated text and the last finish reasons seen. Throws
 * `LlmError` like `chat`.
 *
 * Pass `request.signal` to cancel: an abort is rethrown as-is (it is not an
 * OpenRouter failure and is not logged as one).
 *
 * The SDK timeout may only cover the wait for response headers, so the whole
 * stream is also bounded by LLM_TIMEOUT_MS; running past it ends as
 * LlmError("unavailable").
 *
 * The yielded deltas are what the model produced so far; a later chunk can
 * still turn the result into `blocked` (safety) or `truncated` (max tokens),
 * so callers must treat the returned result as authoritative.
 */
export async function* chatStream(
  logger: Logger,
  client: OpenAI | null,
  request: ChatRequest,
  timeoutMs: number = LLM_TIMEOUT_MS,
): AsyncGenerator<string, ChatResult, undefined> {
  const params: OpenRouterStreamParams = {
    ...buildParams(request),
    stream: true,
  };
  const model = params.model;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = request.signal
    ? AbortSignal.any([request.signal, timeout])
    : timeout;

  let text = "";
  let finishReason: string | null | undefined;
  let nativeFinishReason: string | null | undefined;
  let servedModel: string | undefined;

  try {
    if (!client) {
      throw missingKeyError();
    }
    const stream = await client.chat.completions.create(params, { signal });

    for await (const chunk of stream as AsyncIterable<ChunkWithExtras>) {
      // The SDK throws on an `error` chunk; this covers any it lets through.
      if (chunk.error) {
        throw bodyError(chunk.error);
      }
      servedModel = chunk.model || servedModel;
      const choice = chunk.choices?.[0];
      finishReason = choice?.finish_reason ?? finishReason;
      nativeFinishReason = choice?.native_finish_reason ?? nativeFinishReason;
      const delta = choice?.delta?.content;
      if (delta) {
        text += delta;
        yield delta;
      }
    }

    // The SDK ends an aborted stream quietly instead of throwing. A stream
    // stopped (by the caller or the timeout) before its finish reason was cut
    // off: never classify it as a finished reply.
    if (signal.aborted && !finishReason) {
      throw signal.reason;
    }

    const result = classifyOutcome({ finishReason, nativeFinishReason, text });
    logFallback(logger, model, servedModel, "chatStream");
    logNonOkResult(logger, model, result, "chatStream");
    return result;
  } catch (error) {
    if (request.signal?.aborted) {
      throw error;
    }
    if (timeout.aborted) {
      const llmError = new LlmError(
        "unavailable",
        `OpenRouter stream exceeded ${timeoutMs}ms.`,
        { cause: error },
      );
      logLlmError(
        logger,
        model,
        error,
        llmError,
        "chatStream",
        "Error streaming chat response",
      );
      throw llmError;
    }
    const blocked = blockedResultForError(error);
    if (blocked) {
      logNonOkResult(logger, model, blocked, "chatStream");
      return blocked;
    }
    const llmError = classifyError(error);
    logLlmError(
      logger,
      model,
      error,
      llmError,
      "chatStream",
      "Error streaming chat response",
    );
    throw llmError;
  }
}
