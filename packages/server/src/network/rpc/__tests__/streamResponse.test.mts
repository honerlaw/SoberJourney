import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import superjson from "superjson";
import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import {
  STREAM_RESPONSE_HEADERS,
  streamResponseMeta,
} from "../streamResponseMeta.mjs";
import { TRPC_OPTIONS } from "../trpcOptions.mjs";

/**
 * HTTP-level checks of the production streaming setup (same root options and
 * responseMeta as network/rpc), on a tiny router so no app context is needed.
 */
const t = initTRPC.create({ transformer: superjson, ...TRPC_OPTIONS });

let releaseSecond: () => void = () => {};
let abortableSignal: AbortSignal | undefined;

const appRouter = t.router({
  plain: t.procedure.mutation(() => ({ ok: true })),
  stream: t.procedure.mutation(async function* () {
    yield { n: 1 };
    // Hold the stream open until the test saw the first chunk.
    await new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    yield { n: 2 };
  }),
  // Records the request signal and stays open until it aborts.
  abortable: t.procedure.mutation(async function* ({ signal }) {
    abortableSignal = signal;
    yield { started: true };
    await new Promise<void>((resolve) => {
      if (!signal || signal.aborted) return resolve();
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
  }),
});

function listen(responseMeta?: typeof streamResponseMeta) {
  const app = express();
  app.use(
    "/api/trpc",
    express.json(),
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      ...(responseMeta ? { responseMeta } : {}),
    }),
  );
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

const urlOf = (server: Server, path: string) =>
  `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc/${path}`;

const JSONL_HEADERS = {
  "content-type": "application/json",
  "trpc-accept": "application/jsonl",
};

let withMeta: Server;
let withoutMeta: Server;

before(async () => {
  withMeta = await listen(streamResponseMeta);
  withoutMeta = await listen();
});

after(() => {
  withMeta.close();
  withoutMeta.close();
});

describe("streamed tRPC responses", () => {
  it("sends anti-buffering headers and delivers a chunk before the stream ends", async () => {
    const response = await fetch(urlOf(withMeta, "stream?batch=1"), {
      method: "POST",
      headers: JSONL_HEADERS,
      body: JSON.stringify({ 0: {} }),
    });
    assert.equal(response.status, 200);
    for (const [name, value] of Object.entries(STREAM_RESPONSE_HEADERS)) {
      assert.equal(response.headers.get(name), value);
    }
    assert.equal(response.headers.get("vary"), "trpc-accept");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";
    // The second value is only produced after we release it, so seeing the
    // first one proves incremental delivery.
    while (!received.includes('{"n":1}')) {
      const { value, done } = await reader.read();
      assert.equal(done, false, "stream ended before the first chunk");
      received += decoder.decode(value, { stream: true });
    }
    assert.ok(!received.includes('{"n":2}'));
    releaseSecond();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
    }
    assert.ok(received.includes('{"n":2}'));
  });

  it("aborts the procedure's signal when the client disconnects mid-stream", async () => {
    const client = new AbortController();
    const response = await fetch(urlOf(withMeta, "abortable?batch=1"), {
      method: "POST",
      headers: JSONL_HEADERS,
      body: JSON.stringify({ 0: {} }),
      signal: client.signal,
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes("started")) {
      const { value } = await reader.read();
      received += decoder.decode(value, { stream: true });
    }
    assert.equal(abortableSignal?.aborted, false);
    client.abort();
    for (let i = 0; i < 100 && !abortableSignal?.aborted; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(abortableSignal?.aborted, true);
  });

  it("leaves non-streamed responses unchanged", async () => {
    const call = (server: Server) =>
      fetch(urlOf(server, "plain?batch=1"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 0: {} }),
      });
    const [a, b] = await Promise.all([call(withMeta), call(withoutMeta)]);
    assert.equal(a.status, b.status);
    assert.equal(await a.text(), await b.text());
    const headers = (r: Response) =>
      [...r.headers.entries()].filter(
        ([name]) => !["date", "etag"].includes(name),
      );
    assert.deepEqual(headers(a), headers(b));
    assert.equal(a.headers.get("cache-control"), null);
    assert.equal(a.headers.get("x-accel-buffering"), null);
  });

  it("reports an unknown procedure as NOT_FOUND with its path (client fallback rule)", async () => {
    const response = await fetch(
      urlOf(withMeta, "conversation.streamSponsorChat?batch=1"),
      {
        method: "POST",
        headers: JSONL_HEADERS,
        body: JSON.stringify({ 0: { json: {} } }),
      },
    );
    const body = await response.text();
    const lines = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
    const text = JSON.stringify(lines);
    assert.match(text, /"code":"NOT_FOUND"/);
    assert.match(text, /"path":"conversation.streamSponsorChat"/);
  });
});
