import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { isValidTimeZone } from "../isValidTimeZone.mjs";
import { upsert } from "../upsert.mjs";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../util/__mocks__/database.mjs";

describe("isValidTimeZone", () => {
  it("accepts IANA names", () => {
    for (const tz of [
      "UTC",
      "America/New_York",
      "America/Argentina/Buenos_Aires",
      "Etc/GMT+5",
      "Europe/London",
    ]) {
      assert.equal(isValidTimeZone(tz), true, tz);
    }
  });

  it("rejects invalid values", () => {
    for (const tz of [
      undefined,
      null,
      42,
      ["America/New_York"],
      "",
      "Not/AZone",
      "+05:00",
      "America/New_York; DROP TABLE",
      `America/${"a".repeat(200)}`,
    ]) {
      assert.equal(isValidTimeZone(tz), false, String(tz));
    }
  });
});

describe("user upsert timezone", () => {
  function harness() {
    const userUpsert = mock.fn(async (_args: unknown) => ({ id: "1" }));
    const { client } = mockDatabase({
      user: { upsert: userUpsert as never },
    });
    const { logger } = mockLogger();
    return { userUpsert, client, logger };
  }

  it("stores a valid timezone on create and update", async () => {
    const { userUpsert, client, logger } = harness();
    await upsert(logger, client, "auth", "Europe/London");
    const args = userUpsert.mock.calls[0]?.arguments[0] as never as {
      create: { timezone: string };
      update: { timezone?: string };
    };
    assert.equal(args.create.timezone, "Europe/London");
    assert.deepEqual(args.update, { timezone: "Europe/London" });
  });

  it("keeps the stored timezone when missing or invalid", async () => {
    for (const tz of [undefined, "garbage", "+05:00"]) {
      const { userUpsert, client, logger } = harness();
      await upsert(logger, client, "auth", tz);
      const args = userUpsert.mock.calls[0]?.arguments[0] as never as {
        create: { timezone: string };
        update: object;
      };
      assert.equal(args.create.timezone, "America/New_York");
      assert.deepEqual(args.update, {});
    }
  });
});
