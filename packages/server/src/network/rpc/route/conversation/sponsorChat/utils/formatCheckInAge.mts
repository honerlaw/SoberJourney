import { calendarDayNumber } from "./timeZone.mjs";

/**
 * Describes how long ago a check-in happened, using calendar days in the
 * user's timezone ("yesterday" means the previous calendar day, not 24-48h).
 */
export function formatCheckInAge(
  date: Date,
  now: Date = new Date(),
  timeZone: string = "UTC",
): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "just now";

  const dayDiff =
    calendarDayNumber(now, timeZone) - calendarDayNumber(date, timeZone);

  if (dayDiff <= 0) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (dayDiff === 1) return "yesterday";
  return `${dayDiff} days ago`;
}
