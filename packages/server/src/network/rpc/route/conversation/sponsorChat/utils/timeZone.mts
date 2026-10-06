const FALLBACK_TIME_ZONE = "UTC";

/**
 * Returns `timeZone` if Intl accepts it, otherwise UTC. The stored user
 * timezone comes from a client header and may be invalid.
 */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return FALLBACK_TIME_ZONE;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/**
 * Days since the Unix epoch for the calendar date of `date` in `timeZone`.
 */
export function calendarDayNumber(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Math.round(
    Date.UTC(get("year"), get("month") - 1, get("day")) / (1000 * 60 * 60 * 24),
  );
}

/**
 * e.g. "Tuesday, October 6, 2026 at 3:04 PM (America/New_York)"
 */
export function formatCurrentTime(now: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  return `${formatted} (${timeZone})`;
}

export function buildCurrentTimeContext(now: Date, timeZone: string): string {
  return `

Current date and time for the user: ${formatCurrentTime(now, timeZone)}. Use it when the user refers to times or days (e.g. "tonight", "this weekend").`;
}
