const MINUTES_PER_DAY = 24 * 60
const STEP = 15

// Convert Date to minuteOfDay, rounding to the nearest 15 minute increment.
// Rounding is done on the total minute of day so it carries into the hour
// (9:53 -> 10:00) and wraps past midnight (23:53 -> 00:00). Android's picker
// ignores `minuteInterval`, so any minute can arrive here.
export function dateToMinuteOfDay(date: Date): number {
  const total = date.getHours() * 60 + date.getMinutes()
  return (Math.round(total / STEP) * STEP) % MINUTES_PER_DAY
}
