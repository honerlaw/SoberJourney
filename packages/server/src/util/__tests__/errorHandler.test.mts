import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { errorHandler } from "../middleware/errorHandler.mjs";
import { mockLogger } from "../__mocks__/logger.mjs";

const { logger, mocked } = mockLogger();
let server: Server;
let base: string;

before(async () => {
  // Express's own env: with NODE_ENV unset it is "development", the case
  // where its default handler renders stacks
  const app = express();
  app.use("/api/trpc", express.json(), (_req, res) => res.json({ ok: true }));
  app.get("/boom", () => {
    throw new Error("secret internals at /srv/app/dist/x.mjs");
  });
  app.use(errorHandler(logger));
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe("errorHandler", () => {
  it("answers a malformed JSON body with a plain 400 and no stack", async () => {
    const res = await fetch(`${base}/api/trpc/x`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.equal(text, "Bad Request");
    assert.doesNotMatch(text, /at |node_modules|SyntaxError/);
    assert.ok(mocked.warn.mock.callCount() >= 1);
  });

  it("keeps body-parser's 413 for an oversized body", async () => {
    const res = await fetch(`${base}/api/trpc/x`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: "x".repeat(200_000) }),
    });
    assert.equal(res.status, 413);
    assert.equal(await res.text(), "Payload Too Large");
  });

  it("answers a thrown error with a plain 500 and logs it", async () => {
    const before = mocked.error.mock.callCount();
    const res = await fetch(`${base}/boom`);
    assert.equal(res.status, 500);
    assert.equal(await res.text(), "Internal Server Error");
    assert.equal(mocked.error.mock.callCount(), before + 1);
  });
});
