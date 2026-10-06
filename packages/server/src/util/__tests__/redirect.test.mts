import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import {
  parseApexHosts,
  redirectToWwwMiddleware,
} from "../middleware/redirect.mjs";

function run(host: string | undefined, originalUrl = "/api/trpc/x?y=1") {
  const middleware = redirectToWwwMiddleware(
    parseApexHosts(" soberjourney.app, Example.com "),
  );
  const req = {
    get: (name: string) => (name === "host" ? host : undefined),
    originalUrl,
  } as unknown as Request;
  const redirect = mock.fn();
  const res = { redirect } as unknown as Response;
  const next = mock.fn();
  middleware(req, res, next);
  return { redirect, next };
}

describe("redirectToWwwMiddleware", () => {
  it("parses the allowlist", () => {
    assert.deepEqual(parseApexHosts("a.com, B.com ,,"), ["a.com", "b.com"]);
  });

  it("redirects an allowlisted apex to https www with a 308", () => {
    const { redirect, next } = run("soberjourney.app");
    assert.equal(next.mock.callCount(), 0);
    assert.deepEqual(redirect.mock.calls[0]?.arguments, [
      308,
      "https://www.soberjourney.app/api/trpc/x?y=1",
    ]);
  });

  it("strips the port and lower-cases the host", () => {
    const { redirect } = run("EXAMPLE.com:8080", "/");
    assert.deepEqual(redirect.mock.calls[0]?.arguments, [
      308,
      "https://www.example.com/",
    ]);
  });

  it("passes through www, localhost, unknown and missing hosts", () => {
    for (const host of [
      "www.soberjourney.app",
      "localhost:3000",
      "evil.com",
      "intimate-certainly-opossum.ngrok-free.app",
      undefined,
    ]) {
      const { redirect, next } = run(host);
      assert.equal(redirect.mock.callCount(), 0, String(host));
      assert.equal(next.mock.callCount(), 1, String(host));
    }
  });
});
