import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ApiError, type GoogleGenAI } from "@google/genai";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { GeminiError, GEMINI_TIMEOUT_MS, type ChatResult } from "../chat.mjs";
import { chatStream } from "../chatStream.mjs";

type Chunk = Record<string, unknown>;

function clientStreaming(
  chunks: Chunk[],
  options: { failAfter?: number; error?: unknown; failOnStart?: unknown } = {},
) {
  const generateContentStream = mock.fn(async () => {
    if (options.failOnStart) throw options.failOnStart;
    return (async function* () {
      let index = 0;
      for (const chunk of chunks) {
        if (options.failAfter === index) throw options.error;
        index++;
        yield chunk;
      }
      if (options.failAfter === index) throw options.error;
    })();
  });
  return {
    client: { models: { generateContentStream } } as unknown as GoogleGenAI,
    generateContentStream,
  };
}

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

describe("gemini chatStream", () => {
  it("yields each text chunk and returns the trimmed ok result", async () => {
    const { logger } = mockLogger();
    const { client, generateContentStream } = clientStreaming([
      { text: " Hello" },
      { text: "" },
      { text: " there " },
      { candidates: [{ finishReason: "STOP" }], text: "!" },
    ]);
    const abort = new AbortController();
    const { deltas, result } = await drain(
      chatStream(logger, client, "x", {
        maxOutputTokens: 10,
        abortSignal: abort.signal,
      }),
    );
    assert.deepEqual(deltas, [" Hello", " there ", "!"]);
    assert.deepEqual(result, { status: "ok", text: "Hello there !" });
    const req = (
      generateContentStream.mock.calls[0]!.arguments as unknown[]
    )[0] as {
      model: string;
      config: {
        httpOptions: { timeout: number };
        maxOutputTokens: number;
        abortSignal: AbortSignal;
      };
    };
    assert.equal(req.config.httpOptions.timeout, GEMINI_TIMEOUT_MS);
    assert.equal(req.config.maxOutputTokens, 10);
    assert.equal(req.config.abortSignal, abort.signal);
  });

  it("returns blocked when a later chunk ends with a safety finish reason", async () => {
    const { logger, mocked } = mockLogger();
    const { client } = clientStreaming([
      { text: "partial " },
      { candidates: [{ finishReason: "SAFETY" }] },
    ]);
    const { deltas, result } = await drain(chatStream(logger, client, "x"));
    assert.deepEqual(deltas, ["partial "]);
    assert.deepEqual(result, { status: "blocked", reason: "SAFETY" });
    assert.equal(mocked.warn.mock.callCount(), 1);
    // the streamed text is never logged
    assert.doesNotMatch(
      JSON.stringify(mocked.warn.mock.calls[0]!.arguments),
      /partial/,
    );
  });

  it("returns blocked for a blocked prompt", async () => {
    const { logger } = mockLogger();
    const { client } = clientStreaming([
      { promptFeedback: { blockReason: "PROHIBITED_CONTENT" } },
    ]);
    const { result } = await drain(chatStream(logger, client, "x"));
    assert.deepEqual(result, {
      status: "blocked",
      reason: "PROHIBITED_CONTENT",
    });
  });

  it("returns truncated on MAX_TOKENS", async () => {
    const { logger } = mockLogger();
    const { client } = clientStreaming([
      { text: "cut " },
      { candidates: [{ finishReason: "MAX_TOKENS" }], text: "off" },
    ]);
    const { result } = await drain(chatStream(logger, client, "x"));
    assert.deepEqual(result, { status: "truncated", text: "cut off" });
  });

  it("throws GeminiError for an empty stream", async () => {
    const { logger } = mockLogger();
    const { client } = clientStreaming([
      { candidates: [{ finishReason: "STOP" }] },
    ]);
    await assert.rejects(drain(chatStream(logger, client, "x")), (error) => {
      assert.ok(error instanceof GeminiError);
      assert.equal(error.kind, "unknown");
      return true;
    });
  });

  it("classifies SDK errors at start and mid-stream", async () => {
    const { logger, mocked } = mockLogger();
    const rateLimited = clientStreaming([], {
      failOnStart: new ApiError({ message: "quota", status: 429 }),
    });
    await assert.rejects(
      drain(chatStream(logger, rateLimited.client, "x")),
      (error) => error instanceof GeminiError && error.kind === "rate_limited",
    );

    const midStream = clientStreaming([{ text: "a" }], {
      failAfter: 1,
      error: new ApiError({ message: "down", status: 503 }),
    });
    const deltas: string[] = [];
    await assert.rejects(
      (async () => {
        for await (const delta of chatStream(logger, midStream.client, "x")) {
          deltas.push(delta);
        }
      })(),
      (error) => error instanceof GeminiError && error.kind === "unavailable",
    );
    assert.deepEqual(deltas, ["a"]);
    assert.equal(mocked.error.mock.callCount(), 2);
  });

  it("rethrows an abort as-is without logging it as a Gemini error", async () => {
    const { logger, mocked } = mockLogger();
    const abort = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const { client } = clientStreaming([{ text: "a" }], {
      failAfter: 1,
      error: abortError,
    });
    const generator = chatStream(logger, client, "x", {
      abortSignal: abort.signal,
    });
    assert.deepEqual(await generator.next(), { done: false, value: "a" });
    abort.abort();
    await assert.rejects(generator.next(), (error) => error === abortError);
    assert.equal(mocked.error.mock.callCount(), 0);
  });
});
