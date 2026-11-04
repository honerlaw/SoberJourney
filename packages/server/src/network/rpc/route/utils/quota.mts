import { TRPCError } from "@trpc/server";
import type { Context } from "../../../../context.mjs";
import { getLimit } from "../../../../util/limits.mjs";

/**
 * Soft per-user quotas, checked at create time: a count, then the insert, so
 * parallel requests can overshoot slightly, which is fine for an abuse cap.
 * Only new rows past the quota are refused; existing data is never touched.
 * FORBIDDEN with a plain message: a user-facing code that released apps
 * neither retry nor treat as a sign-out. A failed count fails open.
 *
 * Defaults (JOURNAL_ENTRY_QUOTA / JOURNEY_QUOTA, 0 disables): 5,000 journal
 * entries, check-in journal entries included (more than 13 years of daily
 * journaling), and 200 journeys.
 */
export const JOURNAL_QUOTA_MESSAGE =
  "You've reached the maximum number of journal entries.";
export const JOURNEY_QUOTA_MESSAGE =
  "You've reached the maximum number of journeys.";

export async function assertJournalQuota(ctx: Context, userId: string) {
  const max = getLimit("JOURNAL_ENTRY_QUOTA");
  if (max === 0) {
    return;
  }
  const existing = await ctx.database.journal.count(userId);
  if (existing !== null && existing >= max) {
    throw new TRPCError({ code: "FORBIDDEN", message: JOURNAL_QUOTA_MESSAGE });
  }
}

export async function assertJourneyQuota(ctx: Context, userId: string) {
  const max = getLimit("JOURNEY_QUOTA");
  if (max === 0) {
    return;
  }
  const existing = await ctx.database.journey.count(userId);
  if (existing !== null && existing >= max) {
    throw new TRPCError({ code: "FORBIDDEN", message: JOURNEY_QUOTA_MESSAGE });
  }
}
