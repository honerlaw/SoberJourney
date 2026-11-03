import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { router } from "../../../router.mjs";
import { create as createJournal } from "../../journal/create.mjs";
import { create as createCheckIn } from "../../checkin/create.mjs";
import { create as createJourney } from "../../journey/create.mjs";
import { JOURNAL_QUOTA_MESSAGE, JOURNEY_QUOTA_MESSAGE } from "../quota.mjs";
import { resetMutationRateLimits } from "../../../mutationRateLimit.mjs";

const appRouter = router({
  journal: router({ create: createJournal }),
  checkin: router({ create: createCheckIn }),
  journey: router({ create: createJourney }),
});

const JOURNEY_ID = "11111111-1111-4111-8111-111111111111";

function harness({
  journalCount = 0,
  journeyCount = 0,
}: { journalCount?: number | null; journeyCount?: number | null } = {}) {
  const now = new Date();
  const journalCreate = mock.fn(async () => ({
    id: "j1",
    createdAt: now,
    updatedAt: now,
  }));
  const journeyCreate = mock.fn(async () => ({
    id: JOURNEY_ID,
    title: "t",
    entries: [],
  }));
  const createEntry = mock.fn(async () => ({
    id: "e1",
    createdAt: now,
    updatedAt: now,
  }));
  const ctx = {
    auth: { user: { id: "user-1" } },
    database: {
      journal: {
        count: mock.fn(async () => journalCount),
        create: journalCreate,
      },
      journey: {
        count: mock.fn(async () => journeyCount),
        create: journeyCreate,
        get: mock.fn(async () => ({ id: JOURNEY_ID })),
      },
      checkin: {
        getOrCreate: mock.fn(async () => ({
          id: "c1",
          journeyId: JOURNEY_ID,
          createdAt: now,
          updatedAt: now,
        })),
        createEntry,
      },
    },
    service: {
      encryption: {
        DEKIdentifier: { JOURNAL: "journal" },
        encrypt: async (_c: unknown, _i: unknown, text: string) =>
          `enc:${text}`,
      },
    },
  };
  return {
    caller: appRouter.createCaller(ctx as never),
    journalCreate,
    journeyCreate,
    createEntry,
  };
}

const forbidden = (message: string) => (error: unknown) =>
  error instanceof TRPCError &&
  error.code === "FORBIDDEN" &&
  error.message === message;

afterEach(() => {
  delete process.env.JOURNAL_ENTRY_QUOTA;
  delete process.env.JOURNEY_QUOTA;
  resetMutationRateLimits();
});

describe("journal entry quota", () => {
  it("journal.create is FORBIDDEN at 5,000 existing entries and writes nothing", async () => {
    const { caller, journalCreate } = harness({ journalCount: 5000 });
    await assert.rejects(
      caller.journal.create({ content: "hello" }),
      forbidden(JOURNAL_QUOTA_MESSAGE),
    );
    assert.equal(journalCreate.mock.callCount(), 0);
  });

  it("journal.create succeeds below the quota", async () => {
    const { caller, journalCreate } = harness({ journalCount: 4999 });
    const result = await caller.journal.create({ content: "hello" });
    assert.equal(result.success, true);
    assert.equal(journalCreate.mock.callCount(), 1);
  });

  it("checkin.create with a journal entry is FORBIDDEN at the quota, before any write", async () => {
    const { caller, createEntry, journalCreate } = harness({
      journalCount: 5000,
    });
    await assert.rejects(
      caller.checkin.create({
        journeyId: JOURNEY_ID,
        mood: "GOOD",
        urgeStrength: 3,
        journalEntry: "today",
      }),
      forbidden(JOURNAL_QUOTA_MESSAGE),
    );
    assert.equal(createEntry.mock.callCount(), 0);
    assert.equal(journalCreate.mock.callCount(), 0);
  });

  it("checkin.create without a journal entry is not affected by the quota", async () => {
    const { caller, createEntry } = harness({ journalCount: 5000 });
    const result = await caller.checkin.create({
      journeyId: JOURNEY_ID,
      mood: "GOOD",
      urgeStrength: 3,
      journalEntry: "  ",
    });
    assert.equal(result.success, true);
    assert.equal(createEntry.mock.callCount(), 1);
  });

  it("checkin.create with a journal entry succeeds below the quota", async () => {
    const { caller, journalCreate } = harness({ journalCount: 10 });
    const result = await caller.checkin.create({
      journeyId: JOURNEY_ID,
      mood: "GOOD",
      urgeStrength: 3,
      journalEntry: "today",
    });
    assert.equal(result.journalEntry?.id, "j1");
    assert.equal(journalCreate.mock.callCount(), 1);
  });

  it("fails open when the count fails", async () => {
    const { caller } = harness({ journalCount: null });
    assert.equal(
      (await caller.journal.create({ content: "hello" })).success,
      true,
    );
  });

  it("follows JOURNAL_ENTRY_QUOTA, and 0 disables it", async () => {
    process.env.JOURNAL_ENTRY_QUOTA = "3";
    await assert.rejects(
      harness({ journalCount: 3 }).caller.journal.create({ content: "x" }),
      forbidden(JOURNAL_QUOTA_MESSAGE),
    );
    process.env.JOURNAL_ENTRY_QUOTA = "0";
    assert.equal(
      (
        await harness({ journalCount: 1_000_000 }).caller.journal.create({
          content: "x",
        })
      ).success,
      true,
    );
  });
});

describe("journey quota", () => {
  const input = { title: "Alcohol", startDateTime: new Date("2024-01-01") };

  it("journey.create is FORBIDDEN at 200 journeys and writes nothing", async () => {
    const { caller, journeyCreate } = harness({ journeyCount: 200 });
    await assert.rejects(
      caller.journey.create(input),
      forbidden(JOURNEY_QUOTA_MESSAGE),
    );
    assert.equal(journeyCreate.mock.callCount(), 0);
  });

  it("journey.create succeeds below the quota", async () => {
    const { caller } = harness({ journeyCount: 199 });
    assert.equal((await caller.journey.create(input)).success, true);
  });

  it("follows JOURNEY_QUOTA, and 0 disables it", async () => {
    process.env.JOURNEY_QUOTA = "1";
    await assert.rejects(
      harness({ journeyCount: 1 }).caller.journey.create(input),
      forbidden(JOURNEY_QUOTA_MESSAGE),
    );
    process.env.JOURNEY_QUOTA = "0";
    assert.equal(
      (await harness({ journeyCount: 5000 }).caller.journey.create(input))
        .success,
      true,
    );
  });
});
