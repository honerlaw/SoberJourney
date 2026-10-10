import {
  ApiError,
  BlockedReason,
  FinishReason,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";
import { type Logger } from "../../util/logger/index.mjs";

// The model can be overridden per deployment with GEMINI_MODEL, without a code
// change. Read here (not util/config.mts) so the default stays in this
// datasource. gemini-2.0-flash was retired by Google (404 "no longer
// available"), which took Sponsor chat down; gemini-3.8-flash is the
// replacement Google names in that error.
const DEFAULT_MODEL = "gemini-3.8-flash";

// Gemini 3+ models "think" before answering, and thinking tokens count against
// maxOutputTokens: left at the model default (medium) they can eat a caller's
// budget (a short title, or a reply that ends MAX_TOKENS and is never stored).
// Callers here want short conversational text, so default those models to LOW
// unless the caller set a thinkingConfig itself. LOW, not MINIMAL: MINIMAL is
// only accepted by some Gemini 3 models (gemini-3.8-flash rejects it with a
// 400), while every Gemini 3 text model accepts LOW. Older models are left
// untouched: they reject thinkingLevel.
export function isGemini3OrLater(model: string): boolean {
  const name = model.trim().toLowerCase().replace(/^models\//, "");
  // Rolling aliases (gemini-flash-latest, gemini-pro-latest) point at Gemini 3+.
  if (/^gemini-[a-z-]*latest$/.test(name)) {
    return true;
  }
  const major = Number(/^gemini-(\d+)/.exec(name)?.[1]);
  return major >= 3;
}

export function withModelDefaults(
  model: string,
  config: GenerateContentConfig,
): GenerateContentConfig {
  if (config.thinkingConfig || !isGemini3OrLater(model)) {
    return config;
  }
  return { ...config, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
}

// Upper bound for a single generateContent call. The SDK performs no automatic
// retries on this path, so this is the total time a call can take.
export const GEMINI_TIMEOUT_MS = 60_000;

export function getDefaultModel(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_MODEL;
}

export type ChatResult =
  | { status: "ok"; text: string }
  | { status: "blocked"; reason: string }
  | { status: "truncated"; text: string };

export type GeminiErrorKind = "rate_limited" | "unavailable" | "unknown";

/**
 * Thrown by `chat` when the model could not produce a usable response.
 * The underlying SDK error (if any) is preserved as `cause`.
 */
export class GeminiError extends Error {
  readonly kind: GeminiErrorKind;

  constructor(kind: GeminiErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeminiError";
    this.kind = kind;
  }
}

const BLOCKING_FINISH_REASONS: ReadonlySet<string> = new Set([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

/**
 * The parts of a (possibly streamed) response that decide its outcome.
 * `text` is the full reply text: a single response's text, or the
 * concatenation of every streamed chunk.
 */
export type ResponseOutcome = {
  blockReason?: string | null | undefined;
  finishReason?: string | null | undefined;
  text?: string | null | undefined;
};

/**
 * Classifies a finished response from its block reason, finish reason and
 * text. Shared by `chat` (one response) and `chatStream` (accumulated chunks).
 */
export function classifyOutcome(outcome: ResponseOutcome): ChatResult {
  const { blockReason, finishReason } = outcome;
  if (blockReason && blockReason !== BlockedReason.BLOCKED_REASON_UNSPECIFIED) {
    return { status: "blocked", reason: String(blockReason) };
  }

  if (finishReason && BLOCKING_FINISH_REASONS.has(finishReason)) {
    return { status: "blocked", reason: String(finishReason) };
  }

  const text = outcome.text?.trim() ?? "";

  if (finishReason === FinishReason.MAX_TOKENS) {
    return { status: "truncated", text };
  }

  if (!text) {
    throw new GeminiError(
      "unknown",
      `Gemini returned an empty response (finishReason: ${finishReason ?? "none"}).`,
    );
  }

  return { status: "ok", text };
}

/**
 * Classifies a raw generateContent response. Exported for unit tests.
 */
export function classifyResponse(
  response: GenerateContentResponse,
): ChatResult {
  return classifyOutcome({
    blockReason: response.promptFeedback?.blockReason,
    finishReason: response.candidates?.[0]?.finishReason,
    text: response.text,
  });
}

/**
 * Maps an SDK (or classification) error to a GeminiError. Shared by `chat`
 * and `chatStream`.
 */
export function classifyError(error: unknown): GeminiError {
  if (error instanceof GeminiError) {
    return error;
  }
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new GeminiError("rate_limited", "Gemini rate limit exceeded.", {
        cause: error,
      });
    }
    if (error.status >= 500) {
      return new GeminiError("unavailable", "Gemini is unavailable.", {
        cause: error,
      });
    }
  }
  return new GeminiError("unknown", "Gemini request failed.", { cause: error });
}

/**
 * Logs a blocked or truncated result (never its text). Shared by `chat` and
 * `chatStream`.
 */
export function logNonOkResult(
  logger: Logger,
  model: string,
  result: ChatResult,
  tag: string,
): void {
  if (result.status === "ok") {
    return;
  }
  logger.warn(
    {
      attributes: {
        model,
        status: result.status,
        reason: result.status === "blocked" ? result.reason : undefined,
      },
      tags: ["datasource", "gemini", tag],
    },
    "Gemini returned a non-ok response",
  );
}

export async function chat(
  logger: Logger,
  client: GoogleGenAI,
  contents: ContentListUnion,
  config: GenerateContentConfig = {},
  model: string = getDefaultModel(),
): Promise<ChatResult> {
  try {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        ...withModelDefaults(model, config),
        httpOptions: { timeout: GEMINI_TIMEOUT_MS, ...config.httpOptions },
      },
    });
    const result = classifyResponse(response);
    logNonOkResult(logger, model, result, "chat");
    return result;
  } catch (error) {
    const geminiError = classifyError(error);
    logger.error(
      {
        error,
        attributes: { model, kind: geminiError.kind },
        tags: ["datasource", "gemini", "chat"],
      },
      "Error generating chat response",
    );
    throw geminiError;
  }
}
