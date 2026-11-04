import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import superjson from "superjson";
import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import {
  createTRPCClient,
  httpBatchLink,
  httpBatchStreamLink,
  TRPCClientError,
} from "@trpc/client";
import {
  countProcedures,
  isJsonContentType,
  trpcRequestGuard,
} from "../middleware/trpcRequestGuard.mjs";
import { TRPC_OPTIONS } from "../../network/rpc/trpcOptions.mjs";

const t = initTRPC.create({ transformer: superjson, ...TRPC_OPTIONS });
const appRouter = t.router({
  ping: t.procedure.query(() => "pong"),
  // input-less, like user.remove
  remove: t.procedure.mutation(() => ({ removed: true })),
  stream: t.procedure.mutation(async function* () {
    yield { n: 1 };
  }),
});
type TestRouter = typeof appRouter;

let server: Server;
let base: string;

before(async () => {
  const app = express();
  app.use(
    "/api/trpc",
    trpcRequestGuard(),
    express.json(),
    trpcExpress.createExpressMiddleware({ router: appRouter }),
  );
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc`;
});

after(() => {
  server.close();
});

afterEach(() => {
  delete process.env.TRPC_MAX_BATCH_SIZE;
  delete process.env.TRPC_JSON_ONLY_POSTS;
});

const batchPath = (procedure: string, n: number, separator = ",") =>
  Array.from({ length: n }, () => procedure).join(separator);

async function errorOf(res: Response) {
  const body = (await res.json()) as { error: never };
  return superjson.deserialize(body.error) as {
    message: string;
    code: number;
    data: { code: string; httpStatus: number };
  };
}

describe("countProcedures", () => {
  it("counts like tRPC: last segment, decoded, comma-split", () => {
    assert.equal(countProcedures("/journal.list"), 1);
    assert.equal(countProcedures("/a,b,c"), 3);
    assert.equal(countProcedures("/a%2Cb%2cc"), 3);
    assert.equal(countProcedures("/"), 1);
    assert.equal(countProcedures("/a,%E0%A4%A"), 2);
  });
});

describe("isJsonContentType", () => {
  it("accepts application/json with or without parameters", () => {
    assert.equal(isJsonContentType("application/json"), true);
    assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
    assert.equal(isJsonContentType("Application/JSON"), true);
    assert.equal(isJsonContentType(undefined), false);
    assert.equal(isJsonContentType("text/plain"), false);
    assert.equal(isJsonContentType("application/jsonp"), false);
  });
});

describe("trpcRequestGuard batch cap", () => {
  it("rejects 26 procedures on GET with one tRPC-shaped BAD_REQUEST", async () => {
    const res = await fetch(`${base}/${batchPath("ping", 26)}?batch=1`);
    assert.equal(res.status, 400);
    const error = await errorOf(res);
    assert.equal(error.data.code, "BAD_REQUEST");
    assert.equal(error.data.httpStatus, 400);
    assert.equal(error.code, -32600);
  });

  it("rejects 26 procedures on POST", async () => {
    const res = await fetch(`${base}/${batchPath("remove", 26)}?batch=1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 400);
    assert.equal((await errorOf(res)).data.code, "BAD_REQUEST");
  });

  it("rejects 26 procedures joined with an encoded comma", async () => {
    const res = await fetch(`${base}/${batchPath("ping", 26, "%2C")}?batch=1`);
    assert.equal(res.status, 400);
  });

  it("lets 25 procedures through", async () => {
    const res = await fetch(`${base}/${batchPath("ping", 25)}?batch=1`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.equal(body.length, 25);
  });

  it("follows TRPC_MAX_BATCH_SIZE, and 0 disables the cap", async () => {
    process.env.TRPC_MAX_BATCH_SIZE = "2";
    assert.equal(
      (await fetch(`${base}/${batchPath("ping", 3)}?batch=1`)).status,
      400,
    );
    process.env.TRPC_MAX_BATCH_SIZE = "0";
    assert.equal(
      (await fetch(`${base}/${batchPath("ping", 40)}?batch=1`)).status,
      200,
    );
  });

  it("is applied by httpBatchLink to every op of the batch", async () => {
    process.env.TRPC_MAX_BATCH_SIZE = "1";
    const client = createTRPCClient<TestRouter>({
      links: [httpBatchLink({ url: base, transformer: superjson })],
    });
    const results = await Promise.allSettled([
      client.ping.query(),
      client.ping.query(),
    ]);
    for (const result of results) {
      assert.equal(result.status, "rejected");
      const reason = (result as PromiseRejectedResult).reason;
      assert.ok(reason instanceof TRPCClientError);
      assert.equal(reason.data?.code, "BAD_REQUEST");
    }
  });
});

describe("trpcRequestGuard content-type gate", () => {
  for (const contentType of [
    "multipart/form-data; boundary=x",
    "text/plain",
    "application/octet-stream",
    "application/x-www-form-urlencoded",
  ]) {
    it(`rejects a POST sent as ${contentType} with 415`, async () => {
      const res = await fetch(`${base}/remove`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: "x",
      });
      assert.equal(res.status, 415);
      const error = await errorOf(res);
      assert.equal(error.data.code, "UNSUPPORTED_MEDIA_TYPE");
    });
  }

  it("rejects a POST without a content-type, as tRPC already did", async () => {
    const res = await fetch(`${base}/remove`, { method: "POST" });
    assert.equal(res.status, 415);
  });

  it("lets application/json through, with or without a charset", async () => {
    for (const contentType of [
      "application/json",
      "application/json; charset=utf-8",
    ]) {
      const res = await fetch(`${base}/remove`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: "{}",
      });
      assert.equal(res.status, 200, contentType);
    }
  });

  it("leaves GET alone", async () => {
    const res = await fetch(`${base}/ping`, {
      headers: { "content-type": "text/plain" },
    });
    assert.equal(res.status, 200);
  });

  it("is off with TRPC_JSON_ONLY_POSTS=0", async () => {
    process.env.TRPC_JSON_ONLY_POSTS = "0";
    const res = await fetch(`${base}/remove`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    // tRPC itself still refuses text/plain; the guard no longer answers
    assert.equal(res.status, 415);
    assert.notEqual(
      (await errorOf(res)).message,
      "Requests must be sent as application/json.",
    );
  });

  it("passes the real httpBatchLink and httpBatchStreamLink, input-less mutation included", async () => {
    const batch = createTRPCClient<TestRouter>({
      links: [httpBatchLink({ url: base, transformer: superjson })],
    });
    assert.deepEqual(await batch.remove.mutate(), { removed: true });
    assert.equal(await batch.ping.query(), "pong");

    const streamed = createTRPCClient<TestRouter>({
      links: [
        httpBatchStreamLink({ url: base, transformer: superjson, maxItems: 1 }),
      ],
    });
    const chunks: unknown[] = [];
    for await (const chunk of await streamed.stream.mutate()) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, [{ n: 1 }]);
    assert.deepEqual(await streamed.remove.mutate(), { removed: true });
  });
});
