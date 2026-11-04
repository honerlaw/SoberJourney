import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { getOrCreate } from "../getOrCreate.mjs";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../util/__mocks__/database.mjs";

const row = (userId: string) => ({ id: "c", journeyId: "j", userId });
const ownedJourney = () => mock.fn(async () => ({ id: "j" }));

describe("checkin getOrCreate", () => {
  it("upserts on the unique journey id", async () => {
    const upsert = mock.fn(async () => row("u"));
    const { client } = mockDatabase({
      userJourney: { findFirst: ownedJourney() as never },
      journeyCheckIn: { upsert: upsert as never },
    });
    const { logger } = mockLogger();
    assert.deepEqual(await getOrCreate(logger, client, "j", "u"), row("u"));
    assert.deepEqual(upsert.mock.calls[0]?.arguments, [
      {
        where: { journeyId: "j" },
        create: { journeyId: "j", userId: "u" },
        update: {},
      },
    ] as never);
  });

  it("returns null for another user's check-in", async () => {
    const { client } = mockDatabase({
      userJourney: { findFirst: ownedJourney() as never },
      journeyCheckIn: { upsert: mock.fn(async () => row("other")) as never },
    });
    const { logger } = mockLogger();
    assert.equal(await getOrCreate(logger, client, "j", "u"), null);
  });

  it("re-reads the row when a concurrent create wins the race", async () => {
    const findUnique = mock.fn(async () => row("u"));
    const { client } = mockDatabase({
      userJourney: { findFirst: ownedJourney() as never },
      journeyCheckIn: {
        upsert: mock.fn(async () => {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }) as never,
        findUnique: findUnique as never,
      },
    });
    const { logger, mocked } = mockLogger();
    assert.deepEqual(await getOrCreate(logger, client, "j", "u"), row("u"));
    assert.equal(findUnique.mock.callCount(), 1);
    assert.equal(mocked.error.mock.callCount(), 0);
  });

  it("returns null on other errors", async () => {
    const { client } = mockDatabase({
      userJourney: { findFirst: ownedJourney() as never },
      journeyCheckIn: {
        upsert: mock.fn(async () => {
          throw new Error("db down");
        }) as never,
      },
    });
    const { logger, mocked } = mockLogger();
    assert.equal(await getOrCreate(logger, client, "j", "u"), null);
    assert.equal(mocked.error.mock.callCount(), 1);
  });

  it("returns null and creates no row for a journey the user does not own", async () => {
    const findFirst = mock.fn(async () => null);
    const upsert = mock.fn(async () => row("u"));
    const { client } = mockDatabase({
      userJourney: { findFirst: findFirst as never },
      journeyCheckIn: { upsert: upsert as never },
    });
    const { logger } = mockLogger();
    assert.equal(await getOrCreate(logger, client, "j", "u"), null);
    assert.equal(upsert.mock.callCount(), 0);
    assert.deepEqual(findFirst.mock.calls[0]?.arguments, [
      { where: { id: "j", userId: "u" }, select: { id: true } },
    ] as never);
  });
});
