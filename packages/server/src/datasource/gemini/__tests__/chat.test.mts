import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ApiError, type GoogleGenAI } from "@google/genai";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import {
  chat,
  GeminiError,
  getDefaultModel,
  GEMINI_TIMEOUT_MS,
} from "../chat.mjs";

function clientReturning(impl: () => Promise<unknown>) {
  const generateContent = mock.fn(impl);
  return {
    client: { models: { generateContent } } as unknown as GoogleGenAI,
    generateContent,
  };
}

const response = (fields: Record<string, unknown>) => ({
  candidates: [{ finishReason: "STOP" }],
  text: "hello",
  ...fields,
});

describe("gemini chat", () => {
  afterEach(() => {
    delete process.env.GEMINI_MODEL;
  });

  it("returns ok text and passes a request timeout", async () => {
    const { logger } = mockLogger();
    const { client, generateContent } = clientReturning(async () =>
      response({ text: " hi there " }),
    );
    const result = await chat(logger, client, "x", { maxOutputTokens: 10 });
    assert.deepEqual(result, { status: "ok", text: "hi there" });
    const req = (generateContent.mock.calls[0]!.arguments as unknown[])[0] as {
      model: string;
      config: { httpOptions: { timeout: number }; maxOutputTokens: number };
    };
    assert.equal(req.config.httpOptions.timeout, GEMINI_TIMEOUT_MS);
    assert.equal(req.config.maxOutputTokens, 10);
    assert.equal(req.model, "gemini-2.0-flash");
  });

  it("reads the model name from GEMINI_MODEL", async () => {
    process.env.GEMINI_MODEL = "gemini-test-model";
    assert.equal(getDefaultModel(), "gemini-test-model");
    const { logger } = mockLogger();
    const { client, generateContent } = clientReturning(async () =>
      response({}),
    );
    await chat(logger, client, "x");
    const req = (generateContent.mock.calls[0]!.arguments as unknown[])[0] as {
      model: string;
    };
    assert.equal(req.model, "gemini-test-model");
  });

  it("classifies prompt blocks and safety finish reasons as blocked", async () => {
    const { logger } = mockLogger();
    const blockedPrompt = clientReturning(async () => ({
      promptFeedback: { blockReason: "SAFETY" },
      candidates: [],
    }));
    assert.deepEqual(await chat(logger, blockedPrompt.client, "x"), {
      status: "blocked",
      reason: "SAFETY",
    });
    for (const finishReason of [
      "SAFETY",
      "PROHIBITED_CONTENT",
      "BLOCKLIST",
      "SPII",
      "RECITATION",
    ]) {
      const c = clientReturning(async () =>
        response({ candidates: [{ finishReason }], text: undefined }),
      );
      assert.deepEqual(await chat(logger, c.client, "x"), {
        status: "blocked",
        reason: finishReason,
      });
    }
  });

  it("classifies MAX_TOKENS as truncated", async () => {
    const { logger } = mockLogger();
    const { client } = clientReturning(async () =>
      response({
        candidates: [{ finishReason: "MAX_TOKENS" }],
        text: "partial",
      }),
    );
    assert.deepEqual(await chat(logger, client, "x"), {
      status: "truncated",
      text: "partial",
    });
  });

  it("throws instead of returning null on an empty response", async () => {
    const { logger } = mockLogger();
    const { client } = clientReturning(async () => response({ text: "" }));
    await assert.rejects(chat(logger, client, "x"), (error: unknown) => {
      assert.ok(error instanceof GeminiError);
      assert.equal(error.kind, "unknown");
      return true;
    });
  });

  it("surfaces SDK errors with their cause and a kind", async () => {
    const { logger, mocked } = mockLogger();
    const rateLimit = new ApiError({ message: "quota", status: 429 });
    const c1 = clientReturning(async () => {
      throw rateLimit;
    });
    await assert.rejects(chat(logger, c1.client, "x"), (error: unknown) => {
      assert.ok(error instanceof GeminiError);
      assert.equal(error.kind, "rate_limited");
      assert.equal(error.cause, rateLimit);
      return true;
    });
    assert.equal(mocked.error.mock.callCount(), 1);

    const c2 = clientReturning(async () => {
      throw new ApiError({ message: "down", status: 503 });
    });
    await assert.rejects(chat(logger, c2.client, "x"), { kind: "unavailable" });

    const network = new TypeError("fetch failed");
    const c3 = clientReturning(async () => {
      throw network;
    });
    await assert.rejects(chat(logger, c3.client, "x"), (error: unknown) => {
      assert.ok(error instanceof GeminiError);
      assert.equal(error.kind, "unknown");
      assert.equal(error.cause, network);
      return true;
    });
  });
});
