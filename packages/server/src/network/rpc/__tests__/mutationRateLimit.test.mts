import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { procedure, router } from "../router.mjs";
import {
  consumeMutationRateLimit,
  MUTATION_RATE_LIMIT_MESSAGE,
  resetMutationRateLimits,
} from "../mutationRateLimit.mjs";

const appRouter = router({
  write: procedure.mutation(() => "ok"),
  read: procedure.query(() => "ok"),
});

const callerFor = (userId: string | null) =>
  appRouter.createCaller({
    auth: { user: userId ? { id: userId } : null },
  } as never);

const isTooMany = (error: unknown) =>
  error instanceof TRPCError &&
  error.code === "TOO_MANY_REQUESTS" &&
  error.message === MUTATION_RATE_LIMIT_MESSAGE;

beforeEach(() => resetMutationRateLimits());
afterEach(() => {
  delete process.env.MUTATION_LIMIT_PER_MINUTE;
  delete process.env.MUTATION_LIMIT_PER_HOUR;
  resetMutationRateLimits();
});

describe("mutation rate limit middleware", () => {
  it("rejects the 61st mutation in a minute with TOO_MANY_REQUESTS", async () => {
    const caller = callerFor("u1");
    for (let i = 0; i < 60; i++) {
      assert.equal(await caller.write(), "ok");
    }
    await assert.rejects(caller.write(), isTooMany);
  });

  it("does not count queries", async () => {
    const caller = callerFor("u1");
    for (let i = 0; i < 100; i++) await caller.read();
    for (let i = 0; i < 60; i++) await caller.write();
    await assert.rejects(caller.write(), isTooMany);
    assert.equal(await caller.read(), "ok");
  });

  it("leaves another user unaffected", async () => {
    for (let i = 0; i < 60; i++) await callerFor("u1").write();
    await assert.rejects(callerFor("u1").write(), isTooMany);
    assert.equal(await callerFor("u2").write(), "ok");
  });

  it("lets unauthenticated calls through to the route", async () => {
    for (let i = 0; i < 70; i++) {
      assert.equal(await callerFor(null).write(), "ok");
    }
  });

  it("rejects the 1001st mutation in an hour", () => {
    const start = 1_000_000;
    // 1000 mutations spread out so the minute window never fills
    for (let i = 0; i < 1000; i++) {
      consumeMutationRateLimit("u1", start + i * 3000);
    }
    assert.throws(
      () => consumeMutationRateLimit("u1", start + 1000 * 3000),
      isTooMany,
    );
  });

  it("follows the env overrides, and 0 disables a window", async () => {
    process.env.MUTATION_LIMIT_PER_MINUTE = "2";
    const caller = callerFor("u1");
    await caller.write();
    await caller.write();
    await assert.rejects(caller.write(), isTooMany);

    resetMutationRateLimits();
    process.env.MUTATION_LIMIT_PER_MINUTE = "0";
    process.env.MUTATION_LIMIT_PER_HOUR = "0";
    for (let i = 0; i < 1100; i++) await caller.write();
  });
});
