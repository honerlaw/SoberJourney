import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { logger } from "../logger/index.mjs";
import { describeIssues, getConfig } from "../config.mjs";

const SECRET = "sk_live_super_secret_value";

describe("config", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    mock.restoreAll();
  });

  it("describeIssues never includes input values", () => {
    const result = z
      .object({ KEY: z.string().min(100) })
      .safeParse({ KEY: SECRET });
    assert.equal(result.success, false);
    const issues = describeIssues(result.error);
    assert.ok(issues.length > 0);
    assert.ok(!JSON.stringify(issues).includes(SECRET));
  });

  it("does not log env values when the config fails to load", async () => {
    process.env = { CLERK_SECRET_KEY: SECRET, NODE_ENV: "test" };
    const errorFn = mock.method(logger, "error", () => {});

    await assert.rejects(() => getConfig("CLERK_SECRET_KEY"));

    assert.equal(errorFn.mock.callCount(), 1);
    const logged = JSON.stringify(errorFn.mock.calls[0]?.arguments);
    assert.ok(!logged.includes(SECRET));
    assert.ok(logged.includes("CLERK_JWSK"));
  });
});
