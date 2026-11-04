import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildExpoOptions } from "../client.mjs";

describe("expo client options", () => {
  it("passes EXPO_ACCESS_TOKEN to the client when set", () => {
    assert.deepEqual(buildExpoOptions({ EXPO_ACCESS_TOKEN: " secret " }), {
      accessToken: "secret",
    });
  });

  it("sends unauthenticated when unset or blank (today's behaviour)", () => {
    assert.deepEqual(buildExpoOptions({}), {});
    assert.deepEqual(buildExpoOptions({ EXPO_ACCESS_TOKEN: "  " }), {});
  });
});
