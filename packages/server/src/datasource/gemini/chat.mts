import {
  ApiError,
  BlockedReason,
  FinishReason,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type GoogleGenAI,
} from "@google/genai";
import { type Logger } from "../../util/logger/index.mjs";

// The model can be overridden per deployment with GEMINI_MODEL, without a code
// change. Read here (not util/config.mts) so the default stays in this
// datasource. Caveat: on "thinking" models (gemini-2.5-*) thinking tokens count
// against maxOutputTokens, so callers' limits (sponsor reply 2048, title 32)
// would need a thinkingConfig budget or higher limits before switching.
const DEFAULT_MODEL = "gemini-2.0-flash";

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
 * Classifies a raw generateContent response. Exported for unit tests.
 */
export function classifyResponse(
  response: GenerateContentResponse,
): ChatResult {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason && blockReason !== BlockedReason.BLOCKED_REASON_UNSPECIFIED) {
    return { status: "blocked", reason: String(blockReason) };
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && BLOCKING_FINISH_REASONS.has(finishReason)) {
    return { status: "blocked", reason: String(finishReason) };
  }

  const text = response.text?.trim() ?? "";

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

function classifyError(error: unknown): GeminiError {
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
        ...config,
        httpOptions: { timeout: GEMINI_TIMEOUT_MS, ...config.httpOptions },
      },
    });
    const result = classifyResponse(response);
    if (result.status !== "ok") {
      logger.warn(
        {
          attributes: {
            model,
            status: result.status,
            reason: result.status === "blocked" ? result.reason : undefined,
          },
          tags: ["datasource", "gemini", "chat"],
        },
        "Gemini returned a non-ok response",
      );
    }
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
