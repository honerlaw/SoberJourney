import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { APIError, OpenAI } from "openai";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { LlmError, type ChatRequest, type ChatResult } from "../chat.mjs";
import { chatStream } from "../chatStream.mjs";

type Chunk = Record<string, unknown>;

function clientStreaming(
  chunks: Chunk[],
  options: {
    failAfter?: number;
    error?: unknown;
    failOnStart?: unknown;
    hangAfter?: number;
  } = {},
) {
  const create = mock.fn(
    async (_params: unknown, requestOptions: { signal?: AbortSignal }) => {
      if (options.failOnStart) throw options.failOnStart;
      return (async function* () {
        let index = 0;
        for (const chunk of chunks) {
          if (options.failAfter === index) throw options.error;
          if (options.hangAfter === index) {
            // like openai@7: an aborted stream ends quietly, it does not throw
            const signal = requestOptions.signal!;
            if (!signal.aborted) {
              await new Promise<void>((resolve) => {
                signal.addEventListener("abort", () => resolve(), {
                  once: true,
                });
              });
            }
            return;
          }
          index++;
          yield chunk;
        }
        if (options.failAfter === index) throw options.error;
      })();
    },
  );
  return {
    client: { chat: { completions: { create } } } as unknown as OpenAI,
    create,
  };
}

const chunk = (
  content: string | null,
  finish: { finish_reason?: string; native_finish_reason?: string } = {},
): Chunk => ({
  model: "google/gemini-3.8-flash-20260902",
  choices: [
    {
      delta: content === null ? {} : { content },
      finish_reason: finish.finish_reason ?? null,
      native_finish_reason: finish.native_finish_reason ?? null,
    },
  ],
});

const request: ChatRequest = {
  system: "be kind",
  messages: [{ role: "user", content: "hi" }],
  maxTokens: 10,
};

async function drain(
  generator: AsyncGenerator<string, ChatResult, undefined>,
): Promise<{ deltas: string[]; result: ChatResult }> {
  const deltas: string[] = [];
  while (true) {
    const next = await generator.next();
    if (next.done) return { deltas, result: next.value };
    deltas.push(next.value);
  }
}

/** An error chunk as the SDK throws it mid-stream (no HTTP status). */
function streamError(code: number, metadata?: Record<string, unknown>) {
  return new APIError(
    undefined,
    { code, message: `error ${code}`, metadata },
    undefined,
    undefined,
  );
}

describe("openrouter chatStream", () => {
  it("yields each text chunk and returns the trimmed ok result", async () => {
    const { logger, mocked } = mockLogger();
    const { client, create } = clientStreaming([
      chunk(" Hello"),
      chunk(""),
      chunk(" there "),
      chunk("!", { finish_reason: "stop", native_finish_reason: "STOP" }),
      // the trailing usage chunk
      { model: "google/gemini-3.8-flash-20260902", choices: [], usage: {} },
    ]);
    const abort = new AbortController();
    const { deltas, result } = await drain(
      chatStream(logger, client, { ...request, signal: abort.signal }),
    );
    assert.deepEqual(deltas, [" Hello", " there ", "!"]);
    assert.deepEqual(result, { status: "ok", text: "Hello there !" });
    const [params, options] = create.mock.calls[0]!.arguments as unknown as [
      Record<string, unknown>,
      { signal: AbortSignal },
    ];
    assert.deepEqual(params, {
      model: "google/gemini-3.8-flash",
      models: ["~google/gemini-flash-latest"],
      messages: [
        { role: "system", content: "be kind" },
        { role: "user", content: "hi" },
      ],
      max_tokens: 10,
      reasoning: { effort: "low", exclude: true },
      stream: true,
    });
    // the caller's signal reaches the request (combined with the timeout)
    assert.equal(options.signal.aborted, false);
    abort.abort();
    assert.equal(options.signal.aborted, true);
    assert.equal(mocked.warn.mock.callCount(), 0);
  });

  it("returns blocked when a later chunk ends with a block", async () => {
    const { logger, mocked } = mockLogger();
    const { client } = clientStreaming([
      chunk("partial "),
      chunk(null, {
        finish_reason: "content_filter",
        native_finish_reason: "SAFETY",
      }),
    ]);
    const { deltas, result } = await drain(chatStream(logger, client, request));
    assert.deepEqual(deltas, ["partial "]);
    assert.deepEqual(result, { status: "blocked", reason: "SAFETY" });
    assert.equal(mocked.warn.mock.callCount(), 1);
    // the streamed text is never logged
    assert.doesNotMatch(
      JSON.stringify(mocked.warn.mock.calls[0]!.arguments),
      /partial/,
    );
  });

  it("returns blocked for content_filter without a native reason", async () => {
    const { logger } = mockLogger();
    const { client } = clientStreaming([
      chunk(null, { finish_reason: "content_filter" }),
    ]);
    const { result } = await drain(chatStream(logger, client, request));
    assert.deepEqual(result, { status: "blocked", reason: "SAFETY" });
  });

  it("returns blocked for a content-policy error, at start or mid-stream", async () => {
    const { logger, mocked } = mockLogger();
    const atStart = clientStreaming([], {
      failOnStart: APIError.generate(
        403,
        {
          error: {
            code: 403,
            message: "flagged",
            metadata: { error_type: "content_policy_violation" },
          },
        },
        undefined,
        new Headers(),
      ),
    });
    assert.deepEqual(
      (await drain(chatStream(logger, atStart.client, request))).result,
      { status: "blocked", reason: "SAFETY" },
    );

    const midStream = clientStreaming([chunk("a")], {
      failAfter: 1,
      error: streamError(403, {
        error_type: "content_policy_violation",
        provider_code: "PROHIBITED_CONTENT",
      }),
    });
    const { deltas, result } = await drain(
      chatStream(logger, midStream.client, request),
    );
    assert.deepEqual(deltas, ["a"]);
    assert.deepEqual(result, {
      status: "blocked",
      reason: "PROHIBITED_CONTENT",
    });

    // an error chunk the SDK let through
    const errorChunk = clientStreaming([
      chunk("a"),
      {
        error: {
          code: 403,
          message: "flagged",
          metadata: { reasons: ["violence"] },
        },
        choices: [{ delta: {}, finish_reason: "error" }],
      },
    ]);
    assert.deepEqual(
      (await drain(chatStream(logger, errorChunk.client, request))).result,
      { status: "blocked", reason: "SAFETY" },
    );
    assert.equal(mocked.error.mock.callCount(), 0);
  });

  it("returns truncated on length, including an empty reply", async () => {
    const { logger } = mockLogger();
    const cut = clientStreaming([
      chunk("cut "),
      chunk("off", { finish_reason: "length" }),
    ]);
    assert.deepEqual(
      (await drain(chatStream(logger, cut.client, request))).result,
      { status: "truncated", text: "cut off" },
    );
    const empty = clientStreaming([chunk(null, { finish_reason: "length" })]);
    assert.deepEqual(
      (await drain(chatStream(logger, empty.client, request))).result,
      { status: "truncated", text: "" },
    );
  });

  it("throws LlmError for an empty stream", async () => {
    const { logger } = mockLogger();
    const { client } = clientStreaming([
      chunk(null, { finish_reason: "stop" }),
    ]);
    await assert.rejects(
      drain(chatStream(logger, client, request)),
      (error) => {
        assert.ok(error instanceof LlmError);
        assert.equal(error.kind, "unknown");
        return true;
      },
    );
  });

  it("classifies errors at start and mid-stream", async () => {
    const { logger, mocked } = mockLogger();
    const rateLimited = clientStreaming([], {
      failOnStart: APIError.generate(429, undefined, "quota", new Headers()),
    });
    await assert.rejects(
      drain(chatStream(logger, rateLimited.client, request)),
      (error) => error instanceof LlmError && error.kind === "rate_limited",
    );

    const midStream = clientStreaming([chunk("a")], {
      failAfter: 1,
      error: streamError(502),
    });
    const deltas: string[] = [];
    await assert.rejects(
      (async () => {
        for await (const delta of chatStream(
          logger,
          midStream.client,
          request,
        )) {
          deltas.push(delta);
        }
      })(),
      (error) => error instanceof LlmError && error.kind === "unavailable",
    );
    assert.deepEqual(deltas, ["a"]);

    const credits = clientStreaming([], { failOnStart: streamError(402) });
    await assert.rejects(
      drain(chatStream(logger, credits.client, request)),
      (error) => error instanceof LlmError && error.kind === "unavailable",
    );
    assert.equal(mocked.error.mock.callCount(), 3);
  });

  it("rethrows a caller abort as-is without logging it as an error", async () => {
    const { logger, mocked } = mockLogger();
    const abort = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const { client } = clientStreaming([chunk("a"), chunk("b")], {
      failAfter: 1,
      error: abortError,
    });
    const generator = chatStream(logger, client, {
      ...request,
      signal: abort.signal,
    });
    assert.deepEqual(await generator.next(), { done: false, value: "a" });
    abort.abort();
    await assert.rejects(generator.next(), (error) => error === abortError);
    assert.equal(mocked.error.mock.callCount(), 0);
  });

  it("ends a stream that runs past the timeout as unavailable", async () => {
    const { logger, mocked } = mockLogger();
    const { client } = clientStreaming([chunk("a"), chunk("b")], {
      hangAfter: 1,
    });
    const generator = chatStream(logger, client, request, 20);
    assert.deepEqual(await generator.next(), { done: false, value: "a" });
    await assert.rejects(generator.next(), (error) => {
      assert.ok(error instanceof LlmError);
      assert.equal(error.kind, "unavailable");
      return true;
    });
    assert.equal(mocked.error.mock.callCount(), 1);
  });

  it("rethrows a caller abort even when the SDK ends the stream quietly", async () => {
    const { logger, mocked } = mockLogger();
    const abort = new AbortController();
    const { client } = clientStreaming([chunk("a"), chunk("b")], {
      hangAfter: 1,
    });
    const generator = chatStream(logger, client, {
      ...request,
      signal: abort.signal,
    });
    assert.deepEqual(await generator.next(), { done: false, value: "a" });
    const reason = new DOMException("gone", "AbortError");
    abort.abort(reason);
    await assert.rejects(generator.next(), (error) => error === reason);
    assert.equal(mocked.error.mock.callCount(), 0);
  });

  it("keeps a reply that finished before an abort", async () => {
    const { logger } = mockLogger();
    const abort = new AbortController();
    const { client } = clientStreaming(
      [chunk("done", { finish_reason: "stop" }), chunk("x")],
      { hangAfter: 1 },
    );
    const generator = chatStream(logger, client, {
      ...request,
      signal: abort.signal,
    });
    assert.deepEqual(await generator.next(), { done: false, value: "done" });
    abort.abort();
    assert.deepEqual(await generator.next(), {
      done: true,
      value: { status: "ok", text: "done" },
    });
  });

  it("returns truncated when the stream ends without a finish reason", async () => {
    const { logger } = mockLogger();
    const { client } = clientStreaming([chunk("I hear you, and I")]);
    assert.deepEqual(
      (await drain(chatStream(logger, client, request))).result,
      { status: "truncated", text: "I hear you, and I" },
    );
  });

  it("warns when a fallback model served the stream", async () => {
    const { logger, mocked } = mockLogger();
    const { client } = clientStreaming([
      {
        ...chunk("hi", { finish_reason: "stop" }),
        model: "google/gemini-3.9-flash",
      },
    ]);
    await drain(chatStream(logger, client, request));
    assert.equal(mocked.warn.mock.callCount(), 1);
    assert.match(
      JSON.stringify(mocked.warn.mock.calls[0]!.arguments),
      /fallback/,
    );
  });

  it("fails as unavailable without an API key", async () => {
    const { logger } = mockLogger();
    await assert.rejects(drain(chatStream(logger, null, request)), (error) => {
      assert.ok(error instanceof LlmError);
      assert.equal(error.kind, "unavailable");
      return true;
    });
  });

  describe("with the real openai SDK", () => {
    // An SSE body that sends one chunk and then stalls until aborted.
    function stallingClient() {
      const encoder = new TextEncoder();
      const fetch = async (
        _url: unknown,
        init?: { signal?: AbortSignal | null },
      ) => {
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"id":"1","model":"google/gemini-3.8-flash","choices":[{"index":0,"delta":{"content":"I hear you, and I"},"finish_reason":null}]}\n\n',
              ),
            );
            init?.signal?.addEventListener("abort", () => {
              try {
                controller.error(new DOMException("aborted", "AbortError"));
              } catch {
                // already closed
              }
            });
          },
        });
        return new Response(body, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      };
      return new OpenAI({
        apiKey: "test",
        baseURL: "https://openrouter.ai/api/v1",
        maxRetries: 0,
        fetch,
      });
    }

    it("ends a stalled stream at the timeout as unavailable, not a reply", async () => {
      const { logger } = mockLogger();
      const generator = chatStream(logger, stallingClient(), request, 50);
      assert.deepEqual(await generator.next(), {
        done: false,
        value: "I hear you, and I",
      });
      await assert.rejects(generator.next(), (error) => {
        assert.ok(error instanceof LlmError);
        assert.equal(error.kind, "unavailable");
        return true;
      });
    });

    it("rethrows a caller abort mid-stream instead of returning the partial text", async () => {
      const { logger } = mockLogger();
      const abort = new AbortController();
      const generator = chatStream(logger, stallingClient(), {
        ...request,
        signal: abort.signal,
      });
      assert.deepEqual(await generator.next(), {
        done: false,
        value: "I hear you, and I",
      });
      setTimeout(() => abort.abort(), 10);
      await assert.rejects(generator.next(), (error) => {
        assert.ok(!(error instanceof LlmError));
        assert.ok(abort.signal.aborted);
        return true;
      });
    });
  });
});
