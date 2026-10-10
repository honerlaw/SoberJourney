import { TRPCError } from "@trpc/server";

/**
 * Best-effort, in-process limit on sponsor-chat generations per user, shared
 * by sponsorChat, streamSponsorChat and retrySponsorChat.
 *
 * Like conversationLock, this only counts within one server process: with
 * more than one instance each counts separately, and a restart resets the
 * counts. The hard cost ceiling remains the Gemini project quota.
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

// Above this many tracked users, a full sweep drops users with no recent
// generations, so the map cannot grow without bound.
const SWEEP_THRESHOLD = 10_000;

// Generation timestamps per user id, oldest first.
const generations = new Map<string, number[]>();

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - LONGEST_WINDOW_MS;
  let start = 0;
  while (start < timestamps.length && timestamps[start]! <= cutoff) start++;
  return start === 0 ? timestamps : timestamps.slice(start);
}

function sweep(now: number): void {
  for (const [userId, timestamps] of generations) {
    const kept = prune(timestamps, now);
    if (kept.length === 0) {
      generations.delete(userId);
    } else if (kept !== timestamps) {
      generations.set(userId, kept);
    }
  }
}

/**
 * Records a generation for `userId`, or throws TOO_MANY_REQUESTS (never
 * UNAUTHORIZED) when a limit is reached. Rejected attempts are not recorded,
 * so they neither count nor extend the window. Call after the auth check and
 * before anything is persisted.
 */
export function consumeChatRateLimit(
  userId: string,
  now: number = Date.now(),
): void {
  const timestamps = prune(generations.get(userId) ?? [], now);

  for (const { windowMs, max } of CHAT_RATE_LIMITS) {
    const inWindow = timestamps.filter((t) => t > now - windowMs).length;
    if (inWindow >= max) {
      generations.set(userId, timestamps);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: CHAT_RATE_LIMIT_MESSAGE,
      });
    }
  }

  timestamps.push(now);
  generations.set(userId, timestamps);

  if (generations.size > SWEEP_THRESHOLD) {
    sweep(now);
  }
}

/** Clears all counts. For tests. */
export function resetChatRateLimits(): void {
  generations.clear();
}
