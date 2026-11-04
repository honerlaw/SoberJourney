import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { createRateLimiter } from "../rateLimiter.mjs";

const isTooMany = (error: unknown) =>
  error instanceof TRPCError &&
  error.code === "TOO_MANY_REQUESTS" &&
  error.message === "slow";

describe("createRateLimiter", () => {
  it("allows up to max per window, then rejects without recording", () => {
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max: 3 }],
      message: "slow",
    });
    for (let i = 0; i < 3; i++) limiter.consume("u", 1, 100 + i);
    assert.throws(() => limiter.consume("u", 1, 200), isTooMany);
    assert.throws(() => limiter.consume("u", 1, 300), isTooMany);
    // the window rolls: the first three expire after 1000ms, rejected
    // attempts never extended it
    limiter.consume("u", 1, 1103);
  });

  it("counts cost, and rejects a cost that would cross the max", () => {
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max: 10 }],
      message: "slow",
    });
    limiter.consume("u", 7, 0);
    assert.throws(() => limiter.consume("u", 4, 1), isTooMany);
    limiter.consume("u", 3, 2);
    assert.throws(() => limiter.consume("u", 1, 3), isTooMany);
  });

  it("checks every window", () => {
    const limiter = createRateLimiter({
      limits: () => [
        { windowMs: 1000, max: 5 },
        { windowMs: 10_000, max: 6 },
      ],
      message: "slow",
    });
    for (let i = 0; i < 5; i++) limiter.consume("u", 1, i);
    limiter.consume("u", 1, 1500);
    assert.throws(() => limiter.consume("u", 1, 2600), isTooMany);
  });

  it("keeps users apart", () => {
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max: 1 }],
      message: "slow",
    });
    limiter.consume("a", 1, 0);
    assert.throws(() => limiter.consume("a", 1, 1), isTooMany);
    limiter.consume("b", 1, 1);
  });

  it("treats max 0 as disabled", () => {
    let max = 0;
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max }],
      message: "slow",
    });
    for (let i = 0; i < 100; i++) limiter.consume("u", 1, i);
    assert.equal(limiter.tracked(), 0);
    max = 1;
    limiter.consume("u", 1, 200);
    assert.throws(() => limiter.consume("u", 1, 201), isTooMany);
  });

  it("sweeps idle users above the threshold", () => {
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max: 5 }],
      message: "slow",
      sweepThreshold: 3,
    });
    for (const key of ["a", "b", "c"]) limiter.consume(key, 1, 0);
    assert.equal(limiter.tracked(), 3);
    // a fourth user, long after the others went idle, triggers the sweep
    limiter.consume("d", 1, 120_000);
    assert.equal(limiter.tracked(), 1);
  });

  it("reset clears everything", () => {
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max: 1 }],
      message: "slow",
    });
    limiter.consume("u", 1, 0);
    limiter.reset();
    limiter.consume("u", 1, 1);
  });

  it("charges an oversized cost at the max, so it succeeds once the window is empty", () => {
    const limiter = createRateLimiter({
      limits: () => [{ windowMs: 1000, max: 10 }],
      message: "slow",
    });
    limiter.consume("u", 25, 0);
    assert.throws(() => limiter.consume("u", 1, 500), isTooMany);
    assert.throws(() => limiter.consume("u", 25, 900), isTooMany);
    limiter.consume("u", 25, 1001);
  });
});
