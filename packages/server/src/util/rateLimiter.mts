import { TRPCError } from "@trpc/server";

/**
 * Best-effort, in-process rolling-window limiter keyed by user id.
 *
 * Like the sponsor-chat limiter and the conversation lock, it counts within
 * one server process only: with more than one instance each counts
 * separately, and a restart resets the counts.
 *
 * Each consume records a cost (1 for a request, N for N decrypted values).
 * A rejected consume records nothing, so it neither counts nor extends the
 * window. Rejections are TOO_MANY_REQUESTS, never UNAUTHORIZED (released apps
 * log out on 401).
 */

export type RateLimit = {
  windowMs: number;
  /** Maximum total cost inside the window. 0 disables this window. */
  max: number;
};

export type RateLimiterOptions = {
  /** Read on every consume, so env overrides (and tests) take effect. */
  limits: () => readonly RateLimit[];
  message: string;
  /** Above this many tracked users, idle users are swept (at most once a minute). */
  sweepThreshold?: number;
};

type Entry = { at: number; cost: number };

const SWEEP_INTERVAL_MS = 60_000;

export function createRateLimiter({
  limits,
  message,
  sweepThreshold = 10_000,
}: RateLimiterOptions) {
  const entries = new Map<string, Entry[]>();
  let lastSweep = -Infinity;

  const longestWindow = (active: readonly RateLimit[]) =>
    Math.max(0, ...active.map((l) => l.windowMs));

  function prune(list: Entry[], now: number, windowMs: number): Entry[] {
    const cutoff = now - windowMs;
    let start = 0;
    while (start < list.length && list[start]!.at <= cutoff) start++;
    return start === 0 ? list : list.slice(start);
  }

  function sweep(now: number, windowMs: number): void {
    lastSweep = now;
    for (const [key, list] of entries) {
      const kept = prune(list, now, windowMs);
      if (kept.length === 0) {
        entries.delete(key);
      } else if (kept !== list) {
        entries.set(key, kept);
      }
    }
  }

  /**
   * Records `cost` for `key`, or throws TOO_MANY_REQUESTS when that would
   * take any active window past its max. With every window disabled it
   * records nothing.
   *
   * A cost larger than the smallest max is charged at that max, so one
   * oversized request (e.g. listing more entries than the per-minute decrypt
   * budget) still succeeds once the window is empty, instead of never.
   */
  function consume(key: string, cost = 1, now: number = Date.now()): void {
    const active = limits().filter((l) => l.max > 0);
    if (active.length === 0 || cost <= 0) {
      return;
    }
    cost = Math.min(cost, ...active.map((l) => l.max));

    const windowMs = longestWindow(active);
    const list = prune(entries.get(key) ?? [], now, windowMs);

    for (const { windowMs: w, max } of active) {
      let used = 0;
      for (const entry of list) {
        if (entry.at > now - w) used += entry.cost;
      }
      if (used + cost > max) {
        if (list.length === 0) {
          entries.delete(key);
        } else {
          entries.set(key, list);
        }
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
      }
    }

    list.push({ at: now, cost });
    entries.set(key, list);

    if (entries.size > sweepThreshold && now - lastSweep >= SWEEP_INTERVAL_MS) {
      sweep(now, windowMs);
    }
  }

  return {
    consume,
    /** Number of keys currently tracked. For tests. */
    tracked: () => entries.size,
    /** Clears all counts. For tests. */
    reset: () => {
      entries.clear();
      lastSweep = -Infinity;
    },
  };
}
