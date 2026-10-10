import { APIConnectionError, APIError, type OpenAI } from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { type Logger } from "../../util/logger/index.mjs";

// The model can be overridden per deployment with OPENROUTER_MODEL, without a
// code change. gemini-3.8-flash is the model Sponsor chat used when it called
// Gemini directly, so the move to OpenRouter keeps the same model.
const DEFAULT_MODEL = "google/gemini-3.8-flash";

// Tried by OpenRouter, in order, when the primary model errors (including a
// retired model's 404, which once took Sponsor chat down). A rolling alias
// survives the primary's retirement; it is a different, moving model, so a
// fallback is logged (see logFallback).
const DEFAULT_FALLBACK_MODELS = ["~google/gemini-flash-latest"];

// Reasoning tokens count against max_tokens. Callers want short
// conversational text, so keep thinking LOW (OpenRouter maps effort to
// Gemini's thinkingLevel 1:1) and leave it out of the response.
// require_parameters stays unset, so a model without reasoning ignores this.
export const REASONING = { effort: "low", exclude: true } as const;

// Upper bound for a single call. No automatic retries (maxRetries: 0), so this
// is the total time a non-streamed call can take; chatStream also bounds the
// whole stream with it.
export const LLM_TIMEOUT_MS = 60_000;

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function getDefaultModel(): string {
  const fromEnv = process.env.OPENROUTER_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_MODEL;
}

export function getFallbackModels(): string[] {
  const fromEnv = process.env.OPENROUTER_FALLBACK_MODELS;
  if (fromEnv === undefined) {
    return DEFAULT_FALLBACK_MODELS;
  }
  return fromEnv
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
}

export type ChatRole = "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
};

export type ChatResult =
  | { status: "ok"; text: string }
  | { status: "blocked"; reason: string }
  | { status: "truncated"; text: string };

export type LlmErrorKind = "rate_limited" | "unavailable" | "unknown";

/**
 * Thrown by `chat` / `chatStream` when the model could not produce a usable
 * response. The underlying SDK or OpenRouter error (if any) is kept as
 * `cause`.
 */
export class LlmError extends Error {
  readonly kind: LlmErrorKind;

  constructor(kind: LlmErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmError";
    this.kind = kind;
  }
}

// OpenRouter request fields the OpenAI SDK's types do not know about.
type OpenRouterFields = {
  models?: string[];
  reasoning?: typeof REASONING;
};

export type OpenRouterParams = ChatCompletionCreateParamsNonStreaming &
  OpenRouterFields;
export type OpenRouterStreamParams = ChatCompletionCreateParamsStreaming &
  OpenRouterFields;

/**
 * The request body shared by `chat` and `chatStream`: the system prompt
 * first, then the conversation.
 */
export function buildParams(request: ChatRequest): OpenRouterParams {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: request.system },
    ...request.messages.map(
      (message): ChatCompletionMessageParam => ({
        role: message.role,
        content: message.content,
      }),
    ),
  ];
  const params: OpenRouterParams = {
    model: getDefaultModel(),
    messages,
    max_tokens: request.maxTokens,
    reasoning: REASONING,
  };
  const models = getFallbackModels();
  if (models.length > 0) {
    params.models = models;
  }
  return params;
}

// Gemini's own block reasons, which OpenRouter passes through as
// native_finish_reason or an error's metadata.provider_code.
const BLOCKING_NATIVE_REASONS: ReadonlySet<string> = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "RECITATION",
]);

const BLOCKED_DEFAULT_REASON = "SAFETY";

/**
 * The parts of a (possibly streamed) response that decide its outcome.
 * `text` is the full reply text: a single response's text, or the
 * concatenation of every streamed chunk.
 */
export type ResponseOutcome = {
  finishReason?: string | null | undefined;
  nativeFinishReason?: string | null | undefined;
  text?: string | null | undefined;
};

/**
 * Classifies a finished response from its finish reasons and text. Shared by
 * `chat` (one response) and `chatStream` (accumulated chunks).
 */
export function classifyOutcome(outcome: ResponseOutcome): ChatResult {
  const { finishReason, nativeFinishReason } = outcome;
  const native = nativeFinishReason ? String(nativeFinishReason) : undefined;

  if (native && BLOCKING_NATIVE_REASONS.has(native)) {
    return { status: "blocked", reason: native };
  }
  // A model's own refusal. A non-safety native reason (e.g. Gemini's OTHER)
  // is kept, so it gets the neutral fallback reply rather than the one with
  // the crisis line (see fallbackReplyFor).
  if (finishReason === "content_filter") {
    return { status: "blocked", reason: native ?? BLOCKED_DEFAULT_REASON };
  }
  if (finishReason === "error") {
    throw new LlmError(
      "unavailable",
      "OpenRouter ended the response with an error.",
    );
  }

  const text = outcome.text?.trim() ?? "";

  if (finishReason === "length") {
    return { status: "truncated", text };
  }

  if (!text) {
    throw new LlmError(
      "unknown",
      `OpenRouter returned an empty response (finish_reason: ${finishReason ?? "none"}).`,
    );
  }

  // No finish reason: the response was cut off before it ended (OpenRouter
  // always sends one on a finished response), so it is never stored as a
  // complete reply.
  if (!finishReason) {
    return { status: "truncated", text };
  }

  return { status: "ok", text };
}

/**
 * The OpenRouter error object: the `error` of an error response body, of a
 * 200 body, or of a mid-stream chunk.
 */
type OpenRouterErrorBody = {
  code?: unknown;
  message?: unknown;
  metadata?: Record<string, unknown> | null;
};

function asErrorBody(value: unknown): OpenRouterErrorBody | undefined {
  return value && typeof value === "object"
    ? (value as OpenRouterErrorBody)
    : undefined;
}

/**
 * Error raised when OpenRouter reports an error inside an HTTP 200 body or a
 * stream chunk (it does so once headers were already sent). Classified like
 * an HTTP error with the body's `code` as status.
 */
export class OpenRouterBodyError extends Error {
  readonly error: OpenRouterErrorBody;

  constructor(error: OpenRouterErrorBody) {
    super(
      typeof error.message === "string"
        ? error.message
        : "OpenRouter returned an error",
    );
    this.name = "OpenRouterBodyError";
    this.error = error;
  }
}

/**
 * The error to throw for an `error` object found in a 200 body or a stream
 * chunk.
 */
export function bodyError(value: unknown): OpenRouterBodyError {
  return new OpenRouterBodyError(asErrorBody(value) ?? {});
}

/**
 * A content block reported as an error, or undefined when the error is not
 * one:
 * - `error_type: "content_policy_violation"` (any status): a content filter
 *   outside the model, such as Gemini's SAFETY block. The reason is the
 *   provider's code when there is one (a non-safety code such as OTHER gets
 *   the neutral fallback reply), else SAFETY.
 * - a 403 with `reasons`: OpenRouter's own moderation (harmful-content
 *   categories), so SAFETY.
 * - a 403 whose `provider_code` is a Gemini block reason.
 * Any other 403 — including a provider error that only names the provider,
 * or a key budget limit — is an outage, not a block.
 */
export function blockedReasonForError(
  status: number | undefined,
  body: OpenRouterErrorBody | undefined,
): string | undefined {
  const metadata = body?.metadata ?? undefined;
  const providerCode =
    typeof metadata?.provider_code === "string" && metadata.provider_code
      ? metadata.provider_code
      : undefined;

  if (metadata?.error_type === "content_policy_violation") {
    return providerCode ?? BLOCKED_DEFAULT_REASON;
  }
  if (status !== 403 || !metadata) {
    return undefined;
  }
  if (Array.isArray(metadata.reasons)) {
    return BLOCKED_DEFAULT_REASON;
  }
  if (providerCode && BLOCKING_NATIVE_REASONS.has(providerCode)) {
    return providerCode;
  }
  return undefined;
}

/**
 * The HTTP status (or the error body's `code`, for errors reported inside a
 * 200 response or a stream) and OpenRouter error body of a thrown error.
 */
function statusAndBody(error: unknown): {
  status: number | undefined;
  body: OpenRouterErrorBody | undefined;
} {
  if (error instanceof OpenRouterBodyError) {
    const code = error.error.code;
    return {
      status: typeof code === "number" ? code : undefined,
      body: error.error,
    };
  }
  if (error instanceof APIError) {
    const body = asErrorBody(error.error);
    const code = body?.code;
    const status =
      error.status ?? (typeof code === "number" ? code : undefined);
    return { status, body };
  }
  return { status: undefined, body: undefined };
}

/**
 * A thrown error that is really a content block, as a blocked result.
 */
export function blockedResultForError(error: unknown): ChatResult | undefined {
  const { status, body } = statusAndBody(error);
  const reason = blockedReasonForError(status, body);
  return reason ? { status: "blocked", reason } : undefined;
}

/**
 * Maps an SDK / OpenRouter error to an LlmError. Shared by `chat` and
 * `chatStream`. Content blocks are handled before this
 * (`blockedResultForError`).
 */
export function classifyError(error: unknown): LlmError {
  if (error instanceof LlmError) {
    return error;
  }
  // Includes the SDK's connection timeout.
  if (error instanceof APIConnectionError) {
    return new LlmError("unavailable", "OpenRouter is unreachable.", {
      cause: error,
    });
  }
  const { status } = statusAndBody(error);
  if (status === 429) {
    return new LlmError("rate_limited", "OpenRouter rate limit exceeded.", {
      cause: error,
    });
  }
  if (status === 402) {
    return new LlmError(
      "unavailable",
      "OpenRouter credits are exhausted (402).",
      { cause: error },
    );
  }
  if (
    status !== undefined &&
    (status === 403 || status === 408 || status >= 500)
  ) {
    return new LlmError("unavailable", "OpenRouter is unavailable.", {
      cause: error,
    });
  }
  return new LlmError("unknown", "OpenRouter request failed.", {
    cause: error,
  });
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
      tags: ["datasource", "openrouter", tag],
    },
    "OpenRouter returned a non-ok response",
  );
}

/**
 * Warns when a fallback model (not the requested primary) served the reply,
 * so a retired or failing primary is visible in the logs.
 */
export function logFallback(
  logger: Logger,
  requested: string,
  served: string | null | undefined,
  tag: string,
): void {
  if (!served || servedBy(requested, served)) {
    return;
  }
  logger.warn(
    {
      attributes: { requested, served },
      tags: ["datasource", "openrouter", tag, "fallback"],
    },
    "OpenRouter served the reply with a fallback model",
  );
}

// OpenRouter reports the canonical, dated slug (google/gemini-3.8-flash ->
// google/gemini-3.8-flash-20260902), so the requested slug plus a date
// suffix is the same model. A requested alias (~google/gemini-flash-latest)
// resolves to a concrete slug that cannot be compared, so it never warns.
function servedBy(requested: string, served: string): boolean {
  if (requested.startsWith("~") || served === requested) {
    return true;
  }
  return (
    served.startsWith(`${requested}-`) &&
    /^-\d{8}$/.test(served.slice(requested.length))
  );
}

/**
 * Logs a failed call. A missing key, a credits problem and other failures
 * all go through here.
 */
export function logLlmError(
  logger: Logger,
  model: string,
  error: unknown,
  llmError: LlmError,
  tag: string,
  message: string,
): void {
  logger.error(
    {
      error,
      attributes: { model, kind: llmError.kind, reason: llmError.message },
      tags: ["datasource", "openrouter", tag],
    },
    message,
  );
}

/**
 * The error for a call made without OPENROUTER_API_KEY configured.
 */
export function missingKeyError(): LlmError {
  return new LlmError("unavailable", "OPENROUTER_API_KEY is not set.");
}

type ChatCompletionWithExtras = ChatCompletion & {
  error?: unknown;
  choices: Array<
    ChatCompletion["choices"][number] & { native_finish_reason?: string | null }
  >;
};

/**
 * Classifies a raw (non-streamed) completion. Exported for unit tests.
 */
export function classifyCompletion(completion: ChatCompletion): ChatResult {
  const extended = completion as ChatCompletionWithExtras;
  if (extended.error) {
    throw bodyError(extended.error);
  }
  const choice = extended.choices?.[0];
  return classifyOutcome({
    finishReason: choice?.finish_reason,
    nativeFinishReason: choice?.native_finish_reason,
    text: choice?.message?.content,
  });
}

export async function chat(
  logger: Logger,
  client: OpenAI | null,
  request: ChatRequest,
): Promise<ChatResult> {
  const params = buildParams(request);
  const model = params.model;
  try {
    if (!client) {
      throw missingKeyError();
    }
    const completion = await client.chat.completions.create(
      params,
      request.signal ? { signal: request.signal } : {},
    );
    const result = classifyCompletion(completion);
    logFallback(logger, model, completion.model, "chat");
    logNonOkResult(logger, model, result, "chat");
    return result;
  } catch (error) {
    if (request.signal?.aborted) {
      throw error;
    }
    const blocked = blockedResultForError(error);
    if (blocked) {
      logNonOkResult(logger, model, blocked, "chat");
      return blocked;
    }
    const llmError = classifyError(error);
    logLlmError(
      logger,
      model,
      error,
      llmError,
      "chat",
      "Error generating chat response",
    );
    throw llmError;
  }
}
