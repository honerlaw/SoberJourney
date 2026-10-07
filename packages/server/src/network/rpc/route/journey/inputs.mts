import { z } from "zod";

// generous bound, released apps have no limit on the title input
const MAX_JOURNEY_TITLE_LENGTH = 1000;
export const MAX_REORDER_ITEMS = 1000;

/**
 * Journey titles are trimmed, but a whitespace-only title is kept as-is so
 * inputs that released apps can send are never newly rejected.
 */
export const journeyTitleSchema = z
  .string()
  .min(1, "Journey name is required.")
  .max(MAX_JOURNEY_TITLE_LENGTH, "Journey name is too long.")
  .transform((title) => title.trim() || title);

/**
 * Start dates in the future are clamped to now (released apps' date picker
 * has no maximum date), rather than rejected.
 */
export const startDateTimeSchema = z.date().transform((date) => {
  const now = new Date();
  return date > now ? now : date;
});
