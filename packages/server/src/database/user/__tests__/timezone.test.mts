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
      "GMT",
      "Japan",
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
      "GMT+5",
      "UTC-03:00",
      "America/New_York; DROP TABLE",
      `America/${"a".repeat(200)}`,
    ]) {
      assert.equal(isValidTimeZone(tz), false, String(tz));
    }
  });
});

describe("user upsert timezone", () => {
  function harness(
    existing: { id: string; timezone: string } | null = null,
    findFails = false,
  ) {
    const userUpsert = mock.fn(async (_args: unknown) => ({ id: "1" }));
    const findUnique = mock.fn(async (_args: unknown) => {
      if (findFails) throw new Error("db down");
      return existing;
    });
    const { client } = mockDatabase({
      user: { upsert: userUpsert as never, findUnique: findUnique as never },
    });
    const { logger } = mockLogger();
    return { userUpsert, findUnique, client, logger };
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

  it("does not write when the user exists and the timezone is unchanged", async () => {
    const stored = { id: "1", timezone: "Europe/London" };
    const { userUpsert, findUnique, client, logger } = harness(stored);
    assert.equal(
      await upsert(logger, client, "auth", "Europe/London"),
      stored as never,
    );
    assert.equal(userUpsert.mock.callCount(), 0);
    assert.deepEqual(findUnique.mock.calls[0]?.arguments[0], {
      where: { authId: "auth" },
    });
  });

  it("does not write when the user exists and the timezone is missing or invalid", async () => {
    for (const tz of [undefined, "garbage"]) {
      const stored = { id: "1", timezone: "Europe/London" };
      const { userUpsert, client, logger } = harness(stored);
      assert.equal(await upsert(logger, client, "auth", tz), stored as never);
      assert.equal(userUpsert.mock.callCount(), 0);
    }
  });

  it("writes when a valid timezone differs from the stored one", async () => {
    const { userUpsert, client, logger } = harness({
      id: "1",
      timezone: "America/New_York",
    });
    await upsert(logger, client, "auth", "Europe/London");
    assert.equal(userUpsert.mock.callCount(), 1);
    const args = userUpsert.mock.calls[0]?.arguments[0] as never as {
      update: { timezone?: string };
    };
    assert.deepEqual(args.update, { timezone: "Europe/London" });
  });

  it("writes a new user, and still upserts when the read fails", async () => {
    const created = harness(null);
    await upsert(created.logger, created.client, "auth", undefined);
    assert.equal(created.userUpsert.mock.callCount(), 1);

    const failed = harness(null, true);
    await upsert(failed.logger, failed.client, "auth", "Europe/London");
    assert.equal(failed.userUpsert.mock.callCount(), 1);
  });
});
