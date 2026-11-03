import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { HSTS_VALUE, securityHeaders } from "../middleware/securityHeaders.mjs";

let server: Server;
let url: string;

before(async () => {
  // same proxy and header setup as server.mts
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders());
  app.get("/api/health", (_req, res) => res.status(200).send("OK"));
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`;
});

after(() => {
  server.close();
});

describe("securityHeaders", () => {
  it("sets the framing, nosniff and referrer headers", async () => {
    const res = await fetch(url);
    assert.equal(
      res.headers.get("content-security-policy"),
      "frame-ancestors 'none'",
    );
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      res.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  it("sends HSTS only for HTTPS behind the proxy", async () => {
    const plain = await fetch(url);
    assert.equal(plain.headers.get("strict-transport-security"), null);
    const secure = await fetch(url, {
      headers: { "x-forwarded-proto": "https" },
    });
    assert.equal(secure.headers.get("strict-transport-security"), HSTS_VALUE);
  });
});
