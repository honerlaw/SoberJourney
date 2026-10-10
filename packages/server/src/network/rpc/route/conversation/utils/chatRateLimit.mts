import { TRPCError } from "@trpc/server";

/**
 * Best-effort, in-process limit on sponsor-chat requests per user, shared by
 * sponsorChat, streamSponsorChat and retrySponsorChat. Every accepted request
 * counts, including one that later fails (a retry CONFLICT, a client abort).
 *
 * Like conversationLock, this only counts within one server process: with
 * more than one instance each counts separately, and a restart resets the
 * counts. The hard cost ceiling is the OpenRouter key's credit balance /
 * spend limit.
 *
 * The limits sit far above human typing speed (one message every 3 seconds
 * for a minute, or every 12 seconds for an hour), so a person in distress
 * typing fast never hits them. Released apps never retry chat mutations
 * automatically, so a rejection cannot loop.
 */

export const CHAT_RATE_LIMITS = [
  { windowMs: 60_000, max: 20 },
  { windowMs: 60 * 60_000, max: 300 },
] as const;

export const CHAT_RATE_LIMIT_MESSAGE =
  "You're sending messages faster than I can keep up. Please wait a moment and try again.";

const LONGEST_WINDOW_MS = Math.max(...CHAT_RATE_LIMITS.map((l) => l.windowMs));

// Above this many tracked users, a full sweep (at most once per minute)
// drops users with no request in the last hour, so the map holds only
// recently active users.
const SWEEP_THRESHOLD = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

// Accepted request timestamps per user id, oldest first.
const requests = new Map<string, number[]>();
let lastSweep = -Infinity;

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - LONGEST_WINDOW_MS;
  let start = 0;
  while (start < timestamps.length && timestamps[start]! <= cutoff) start++;
  return start === 0 ? timestamps : timestamps.slice(start);
}

function sweep(now: number): void {
  lastSweep = now;
  for (const [userId, timestamps] of requests) {
    const kept = prune(timestamps, now);
    if (kept.length === 0) {
      requests.delete(userId);
    } else if (kept !== timestamps) {
      requests.set(userId, kept);
    }
  }
}

/**
 * Records a request for `userId`, or throws TOO_MANY_REQUESTS (never
 * UNAUTHORIZED) when a limit is reached. Rejected attempts are not recorded,
 * so they neither count nor extend the window. Call after the auth check and
 * before anything is persisted.
 */
export function consumeChatRateLimit(
  userId: string,
  now: number = Date.now(),
): void {
  const timestamps = prune(requests.get(userId) ?? [], now);

  for (const { windowMs, max } of CHAT_RATE_LIMITS) {
    const inWindow = timestamps.filter((t) => t > now - windowMs).length;
    if (inWindow >= max) {
      requests.set(userId, timestamps);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: CHAT_RATE_LIMIT_MESSAGE,
      });
    }
  }

  timestamps.push(now);
  requests.set(userId, timestamps);

  if (requests.size > SWEEP_THRESHOLD && now - lastSweep >= SWEEP_INTERVAL_MS) {
    sweep(now);
  }
}

/** Number of users currently tracked. For tests. */
export function trackedChatRateLimitUsers(): number {
  return requests.size;
}

/** Clears all counts. For tests. */
export function resetChatRateLimits(): void {
  requests.clear();
  lastSweep = -Infinity;
}
