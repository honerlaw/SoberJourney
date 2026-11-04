import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildClerkOptions, parseAuthorizedParties } from "../clerkOptions.mjs";

describe("parseAuthorizedParties", () => {
  it("splits, trims and drops empty entries", () => {
    assert.deepEqual(
      parseAuthorizedParties(
        " https://www.soberjourney.app , https://soberjourney.app,,",
      ),
      ["https://www.soberjourney.app", "https://soberjourney.app"],
    );
  });

  it("is undefined when unset or blank", () => {
    assert.equal(parseAuthorizedParties(undefined), undefined);
    assert.equal(parseAuthorizedParties(""), undefined);
    assert.equal(parseAuthorizedParties(" , "), undefined);
  });
});

describe("buildClerkOptions authorizedParties", () => {
  it("passes CLERK_AUTHORIZED_PARTIES through when set", () => {
    const options = buildClerkOptions({
      CLERK_AUTHORIZED_PARTIES: "https://www.soberjourney.app",
    });
    assert.deepEqual(options.authorizedParties, [
      "https://www.soberjourney.app",
    ]);
    assert.equal(options.enableHandshake, true);
  });

  it("leaves the option out entirely when unset (today's behaviour)", () => {
    assert.equal("authorizedParties" in buildClerkOptions({}), false);
  });
});
