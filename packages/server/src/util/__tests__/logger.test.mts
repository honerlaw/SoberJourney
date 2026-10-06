import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveLogLevel } from "../logger/index.mjs";

describe("resolveLogLevel", () => {
  it("defaults to info in production", () => {
    assert.equal(resolveLogLevel({ NODE_ENV: "production" }), "info");
  });

  it("defaults to debug outside production", () => {
    assert.equal(resolveLogLevel({ NODE_ENV: "development" }), "debug");
    assert.equal(resolveLogLevel({}), "debug");
  });

  it("honors a valid LOG_LEVEL", () => {
    assert.equal(
      resolveLogLevel({ NODE_ENV: "production", LOG_LEVEL: "TRACE" }),
      "trace",
    );
  });

  it("ignores an invalid LOG_LEVEL", () => {
    assert.equal(
      resolveLogLevel({ NODE_ENV: "production", LOG_LEVEL: "verbose" }),
      "info",
    );
  });
});
