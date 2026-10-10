import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import {
  CHAT_RATE_LIMIT_MESSAGE,
  CHAT_RATE_LIMITS,
  consumeChatRateLimit,
  resetChatRateLimits,
} from "../chatRateLimit.mjs";

const [PER_MINUTE, PER_HOUR] = CHAT_RATE_LIMITS;
const T0 = 1_000_000_000_000;

function isTooManyRequests(error: unknown): boolean {
  return (
    error instanceof TRPCError &&
    error.code === "TOO_MANY_REQUESTS" &&
    error.message === CHAT_RATE_LIMIT_MESSAGE
  );
}

describe("consumeChatRateLimit", () => {
  beforeEach(() => resetChatRateLimits());

  it("allows the per-minute maximum and rejects the next one", () => {
    for (let i = 0; i < PER_MINUTE.max; i++) consumeChatRateLimit("u1", T0 + i);
    assert.throws(
      () => consumeChatRateLimit("u1", T0 + PER_MINUTE.max),
      isTooManyRequests,
    );
  });

  it("does not record rejected attempts", () => {
    for (let i = 0; i < PER_MINUTE.max; i++) consumeChatRateLimit("u1", T0);
    for (let i = 0; i < 50; i++) {
      assert.throws(() => consumeChatRateLimit("u1", T0 + 30_000));
    }
    // Only the original generations count, so the window still ends a minute
    // after them, not after the rejected attempts.
    consumeChatRateLimit("u1", T0 + PER_MINUTE.windowMs + 1);
  });

  it("slides: allowed again once the window has passed", () => {
    for (let i = 0; i < PER_MINUTE.max; i++) consumeChatRateLimit("u1", T0);
    assert.throws(() =>
      consumeChatRateLimit("u1", T0 + PER_MINUTE.windowMs - 1),
    );
    consumeChatRateLimit("u1", T0 + PER_MINUTE.windowMs + 1);
  });

  it("enforces the hourly maximum at a pace under the per-minute limit", () => {
    const step = Math.ceil(PER_MINUTE.windowMs / (PER_MINUTE.max - 1));
    let now = T0;
    for (let i = 0; i < PER_HOUR.max; i++) {
      consumeChatRateLimit("u1", now);
      now += step;
    }
    assert.ok(now - T0 < PER_HOUR.windowMs);
    assert.throws(() => consumeChatRateLimit("u1", now), isTooManyRequests);
    // The oldest generation leaves the hour window.
    consumeChatRateLimit("u1", T0 + PER_HOUR.windowMs + 1);
  });

  it("counts each user separately", () => {
    for (let i = 0; i < PER_MINUTE.max; i++) consumeChatRateLimit("u1", T0);
    assert.throws(() => consumeChatRateLimit("u1", T0));
    consumeChatRateLimit("u2", T0);
  });
});
