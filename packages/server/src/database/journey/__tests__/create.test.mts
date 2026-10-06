import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { create } from "../create.mjs";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../util/__mocks__/database.mjs";

type CreateArgs = {
  data: { checkIn?: unknown; entries: unknown; title: string; userId: string };
  include: unknown;
};

function harness() {
  const journeyCreate = mock.fn(async (_args: unknown) => ({
    id: "j",
    entries: [],
  }));
  const { client } = mockDatabase({
    userJourney: { create: journeyCreate as never },
  });
  const { logger } = mockLogger();
  return { journeyCreate, client, logger };
}

describe("journey create", () => {
  const start = new Date("2024-01-01T00:00:00Z");

  it("creates the journey and first entry in one statement", async () => {
    const { journeyCreate, client, logger } = harness();
    await create(logger, client, "u", "title", start);
    assert.equal(journeyCreate.mock.callCount(), 1);
    const args = journeyCreate.mock.calls[0]
      ?.arguments[0] as never as CreateArgs;
    assert.deepEqual(args.data.entries, { create: { createdAt: start } });
    assert.equal(args.data.checkIn, undefined);
    assert.deepEqual(args.include, { entries: true });
  });

  it("nests the check-in and schedule when settings are given", async () => {
    const { journeyCreate, client, logger } = harness();
    await create(logger, client, "u", "title", start, {
      frequency: "DAILY",
      minuteOfDay: 593,
    });
    assert.equal(journeyCreate.mock.callCount(), 1);
    const args = journeyCreate.mock.calls[0]
      ?.arguments[0] as never as CreateArgs;
    assert.deepEqual(args.data.checkIn, {
      create: {
        userId: "u",
        pushNotificationSchedule: {
          create: { userId: "u", frequency: "DAILY", minuteOfDay: 593 },
        },
      },
    });
  });

  it("returns null on failure", async () => {
    const { client } = mockDatabase({
      userJourney: {
        create: mock.fn(async () => {
          throw new Error("db down");
        }) as never,
      },
    });
    const { logger } = mockLogger();
    assert.equal(await create(logger, client, "u", "title", start), null);
  });
});
