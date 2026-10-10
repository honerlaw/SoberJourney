import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OpenAI } from "openai";
import { clientOptions, createClient } from "../createClient.mjs";

describe("openrouter createClient", () => {
  it("points the OpenAI SDK at OpenRouter with no retries and a 60s timeout", () => {
    assert.deepEqual(clientOptions("sk-or-test"), {
      apiKey: "sk-or-test",
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 60_000,
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": "https://soberjourney.app",
        "X-OpenRouter-Title": "SoberJourney",
      },
    });
    const client = createClient("sk-or-test");
    assert.ok(client instanceof OpenAI);
    assert.equal(client.baseURL, "https://openrouter.ai/api/v1");
    assert.equal(client.timeout, 60_000);
    assert.equal(client.maxRetries, 0);
  });

  it("returns null without an API key", () => {
    assert.equal(createClient(undefined), null);
    assert.equal(createClient(""), null);
  });
});
