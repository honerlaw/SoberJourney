import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  type OpenAI,
} from "openai";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import {
  chat,
  getDefaultModel,
  getFallbackModels,
  LlmError,
  type ChatRequest,
} from "../chat.mjs";

function clientReturning(impl: () => Promise<unknown>) {
  const create = mock.fn(impl);
  return {
    client: { chat: { completions: { create } } } as unknown as OpenAI,
    create,
  };
}

const request: ChatRequest = {
  system: "be kind",
  messages: [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "how are you" },
  ],
  maxTokens: 10,
};

const completion = (
  choice: Record<string, unknown> = {},
  fields: Record<string, unknown> = {},
) => ({
  model: "google/gemini-3.8-flash-20260902",
  choices: [
    {
      finish_reason: "stop",
      native_finish_reason: "STOP",
      message: { role: "assistant", content: "hello" },
      ...choice,
    },
  ],
  ...fields,
});

/** An HTTP error as the SDK builds it from OpenRouter's error body. */
function httpError(
  status: number,
  metadata?: Record<string, unknown>,
): APIError {
  return APIError.generate(
    status,
    { error: { code: status, message: `error ${status}`, metadata } },
    undefined,
    new Headers(),
  );
}

async function rejectsWithKind(
  promise: Promise<unknown>,
  kind: LlmError["kind"],
  cause?: unknown,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof LlmError);
    assert.equal(error.kind, kind);
    if (cause !== undefined) assert.equal(error.cause, cause);
    return true;
  });
}

describe("openrouter chat", () => {
  afterEach(() => {
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_FALLBACK_MODELS;
  });

  it("returns ok text and sends the OpenRouter request shape", async () => {
    const { logger, mocked } = mockLogger();
    const { client, create } = clientReturning(async () =>
      completion({ message: { role: "assistant", content: " hi there " } }),
    );
    const result = await chat(logger, client, request);
    assert.deepEqual(result, { status: "ok", text: "hi there" });

    const [params, options] = create.mock.calls[0]!.arguments as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    assert.deepEqual(params, {
      model: "google/gemini-3.8-flash",
      models: ["~google/gemini-flash-latest"],
      messages: [
        { role: "system", content: "be kind" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "how are you" },
      ],
      max_tokens: 10,
      reasoning: { effort: "low", exclude: true },
    });
    assert.equal("provider" in params, false);
    assert.deepEqual(options, {});
    // the dated canonical slug of the primary is not a fallback
    assert.equal(mocked.warn.mock.callCount(), 0);
  });

  it("passes the caller's abort signal", async () => {
    const { logger } = mockLogger();
    const { client, create } = clientReturning(async () => completion());
    const abort = new AbortController();
    await chat(logger, client, { ...request, signal: abort.signal });
    const [, options] = create.mock.calls[0]!.arguments as unknown as [
      unknown,
      { signal?: AbortSignal },
    ];
    assert.equal(options.signal, abort.signal);
  });

  it("reads the model and fallbacks from the environment", async () => {
    process.env.OPENROUTER_MODEL = " anthropic/claude-haiku-5.5 ";
    process.env.OPENROUTER_FALLBACK_MODELS = "a/one, b/two ,,";
    assert.equal(getDefaultModel(), "anthropic/claude-haiku-5.5");
    assert.deepEqual(getFallbackModels(), ["a/one", "b/two"]);

    const { logger } = mockLogger();
    const { client, create } = clientReturning(async () =>
      completion({}, { model: "anthropic/claude-haiku-5.5" }),
    );
    await chat(logger, client, request);
    const [params] = create.mock.calls[0]!.arguments as unknown as [
      { model: string; models: string[] },
    ];
    assert.equal(params.model, "anthropic/claude-haiku-5.5");
    assert.deepEqual(params.models, ["a/one", "b/two"]);
  });

  it("sends no fallback list when OPENROUTER_FALLBACK_MODELS is empty", async () => {
    process.env.OPENROUTER_FALLBACK_MODELS = "";
    const { logger } = mockLogger();
    const { client, create } = clientReturning(async () => completion());
    await chat(logger, client, request);
    const [params] = create.mock.calls[0]!.arguments as unknown as [
      Record<string, unknown>,
    ];
    assert.equal("models" in params, false);
  });

  it("warns when a fallback model served the reply", async () => {
    const { logger, mocked } = mockLogger();
    const { client } = clientReturning(async () =>
      completion({}, { model: "google/gemini-3.9-flash-20261001" }),
    );
    assert.deepEqual(await chat(logger, client, request), {
      status: "ok",
      text: "hello",
    });
    assert.equal(mocked.warn.mock.callCount(), 1);
    const logged = JSON.stringify(mocked.warn.mock.calls[0]!.arguments);
    assert.match(logged, /google\/gemini-3\.9-flash-20261001/);
    assert.match(logged, /"requested":"google\/gemini-3\.8-flash"/);
  });

  it("compares the served model by dated slug only", async () => {
    const served = async (model: string, primary?: string) => {
      if (primary) process.env.OPENROUTER_MODEL = primary;
      const { logger, mocked } = mockLogger();
      const { client } = clientReturning(async () => completion({}, { model }));
      await chat(logger, client, request);
      delete process.env.OPENROUTER_MODEL;
      return mocked.warn.mock.callCount();
    };
    assert.equal(await served("google/gemini-3.8-flash"), 0);
    assert.equal(await served("google/gemini-3.8-flash-20260902"), 0);
    assert.equal(await served("google/gemini-3.8-flash-lite"), 1);
    assert.equal(await served("google/gemini-3.8-flash-preview-0901"), 1);
    // an alias primary cannot be compared, so it never warns
    assert.equal(
      await served(
        "google/gemini-3.8-flash-20260902",
        "~google/gemini-flash-latest",
      ),
      0,
    );
  });

  it("classifies content_filter and Gemini block reasons as blocked", async () => {
    const { logger, mocked } = mockLogger();
    const filtered = clientReturning(async () =>
      completion({
        finish_reason: "content_filter",
        native_finish_reason: null,
        message: { role: "assistant", content: null },
      }),
    );
    assert.deepEqual(await chat(logger, filtered.client, request), {
      status: "blocked",
      reason: "SAFETY",
    });
    for (const native of [
      "SAFETY",
      "PROHIBITED_CONTENT",
      "BLOCKLIST",
      "SPII",
      "RECITATION",
    ]) {
      const c = clientReturning(async () =>
        completion({
          finish_reason: "stop",
          native_finish_reason: native,
          message: { role: "assistant", content: "" },
        }),
      );
      assert.deepEqual(await chat(logger, c.client, request), {
        status: "blocked",
        reason: native,
      });
    }
    // a refusal with a non-safety native reason keeps it
    const other = clientReturning(async () =>
      completion({
        finish_reason: "content_filter",
        native_finish_reason: "OTHER",
        message: { role: "assistant", content: null },
      }),
    );
    assert.deepEqual(await chat(logger, other.client, request), {
      status: "blocked",
      reason: "OTHER",
    });
    // an unknown native reason errs toward SAFETY
    const unknown = clientReturning(async () =>
      completion({
        finish_reason: "content_filter",
        native_finish_reason: "refusal",
        message: { role: "assistant", content: null },
      }),
    );
    assert.deepEqual(await chat(logger, unknown.client, request), {
      status: "blocked",
      reason: "SAFETY",
    });
    // logged without any text
    assert.equal(mocked.warn.mock.callCount(), 8);
  });

  it("treats a missing finish reason as truncated and an error finish as unavailable", async () => {
    const { logger } = mockLogger();
    const cut = clientReturning(async () =>
      completion({ finish_reason: null, native_finish_reason: null }),
    );
    assert.deepEqual(await chat(logger, cut.client, request), {
      status: "truncated",
      text: "hello",
    });
    const errored = clientReturning(async () =>
      completion({ finish_reason: "error" }),
    );
    await rejectsWithKind(chat(logger, errored.client, request), "unavailable");
  });

  it("classifies length as truncated, including an empty reply", async () => {
    const { logger } = mockLogger();
    const partial = clientReturning(async () =>
      completion({
        finish_reason: "length",
        message: { role: "assistant", content: "partial" },
      }),
    );
    assert.deepEqual(await chat(logger, partial.client, request), {
      status: "truncated",
      text: "partial",
    });
    const empty = clientReturning(async () =>
      completion({
        finish_reason: "length",
        message: { role: "assistant", content: null },
      }),
    );
    assert.deepEqual(await chat(logger, empty.client, request), {
      status: "truncated",
      text: "",
    });
  });

  it("throws an unknown LlmError on an empty reply", async () => {
    const { logger } = mockLogger();
    const { client } = clientReturning(async () =>
      completion({ message: { role: "assistant", content: "  " } }),
    );
    await rejectsWithKind(chat(logger, client, request), "unknown");
  });

  it("treats content-policy errors as blocked, wherever they arrive", async () => {
    const { logger, mocked } = mockLogger();
    const cases: Array<[() => Promise<unknown>, string]> = [
      // Gemini's SAFETY filter, as an HTTP 403
      [
        async () => {
          throw httpError(403, {
            error_type: "content_policy_violation",
            provider_name: "Google",
            provider_code: "PROHIBITED_CONTENT",
          });
        },
        "PROHIBITED_CONTENT",
      ],
      // the same, with any status
      [
        async () => {
          throw httpError(400, { error_type: "content_policy_violation" });
        },
        "SAFETY",
      ],
      // another provider's filter code errs toward SAFETY
      [
        async () => {
          throw httpError(403, {
            error_type: "content_policy_violation",
            provider_code: "content_filter",
          });
        },
        "SAFETY",
      ],
      // moderation wins over a provider code
      [
        async () => {
          throw httpError(403, {
            reasons: ["self-harm"],
            provider_code: "OTHER",
          });
        },
        "SAFETY",
      ],
      // OpenRouter moderation
      [
        async () => {
          throw httpError(403, { reasons: ["self-harm"], flagged_input: "x" });
        },
        "SAFETY",
      ],
      // a 403 carrying a Gemini block code
      [
        async () => {
          throw httpError(403, {
            provider_name: "Google",
            provider_code: "SAFETY",
          });
        },
        "SAFETY",
      ],
      // a non-safety provider code is kept (neutral fallback reply)
      [
        async () => {
          throw httpError(403, {
            error_type: "content_policy_violation",
            provider_code: "OTHER",
          });
        },
        "OTHER",
      ],
      // reported inside a 200 body
      [
        async () => ({
          error: {
            code: 403,
            message: "flagged",
            metadata: { error_type: "content_policy_violation" },
          },
        }),
        "SAFETY",
      ],
    ];
    for (const [impl, reason] of cases) {
      const { client } = clientReturning(impl);
      assert.deepEqual(await chat(logger, client, request), {
        status: "blocked",
        reason,
      });
    }
    assert.equal(mocked.error.mock.callCount(), 0);
  });

  it("maps other errors to an LlmError kind, keeping the cause", async () => {
    const { logger, mocked } = mockLogger();
    const cases: Array<[unknown, LlmError["kind"]]> = [
      [httpError(429), "rate_limited"],
      [httpError(402), "unavailable"],
      [httpError(403, { limit_source: "key" }), "unavailable"],
      [httpError(403), "unavailable"],
      // an upstream provider error that only names the provider is an outage
      [httpError(403, { provider_name: "Google", raw: "{}" }), "unavailable"],
      [
        httpError(403, { provider_name: "Google", provider_code: "OTHER" }),
        "unavailable",
      ],
      [httpError(408), "unavailable"],
      [httpError(500), "unavailable"],
      [httpError(502), "unavailable"],
      [httpError(503), "unavailable"],
      [new APIConnectionError({ message: "down" }), "unavailable"],
      [new APIConnectionTimeoutError(), "unavailable"],
      [httpError(400), "unknown"],
      [httpError(401), "unknown"],
      [httpError(404), "unknown"],
      [new TypeError("bug"), "unknown"],
    ];
    for (const [error, kind] of cases) {
      const { client } = clientReturning(async () => {
        throw error;
      });
      await rejectsWithKind(chat(logger, client, request), kind, error);
    }
    // a 200 body carrying a non-block error
    const body = clientReturning(async () => ({
      error: { code: 502, message: "provider down" },
    }));
    await rejectsWithKind(chat(logger, body.client, request), "unavailable");
    assert.equal(mocked.error.mock.callCount(), cases.length + 1);
    // a 402 says so in the log
    assert.match(
      JSON.stringify(mocked.error.mock.calls[1]!.arguments),
      /credits are exhausted/,
    );
  });

  it("rethrows a caller abort as-is, unlogged", async () => {
    const { logger, mocked } = mockLogger();
    const abort = new AbortController();
    abort.abort();
    const abortError = new DOMException("aborted", "AbortError");
    const { client } = clientReturning(async () => {
      throw abortError;
    });
    await assert.rejects(
      chat(logger, client, { ...request, signal: abort.signal }),
      (error) => error === abortError,
    );
    assert.equal(mocked.error.mock.callCount(), 0);
  });

  it("fails as unavailable, and logs, without an API key", async () => {
    const { logger, mocked } = mockLogger();
    await rejectsWithKind(chat(logger, null, request), "unavailable");
    assert.equal(mocked.error.mock.callCount(), 1);
    assert.match(
      JSON.stringify(mocked.error.mock.calls[0]!.arguments),
      /OPENROUTER_API_KEY is not set/,
    );
  });
});
