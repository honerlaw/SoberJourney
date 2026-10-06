import {
  addDays,
  addHours,
  addMinutes,
  addYears,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  differenceInYears,
} from "date-fns"

export type DurationSection = {
  value: number
  max: number
  label: string
  singularLabel: string
}

/**
 * Break the time elapsed between `start` and `now` into display sections.
 *
 * Every section is derived from ONE chained computation so they always agree:
 * years and days are calendar units (local time, DST-aware), and hours,
 * minutes and seconds are the elapsed remainder after the calendar part:
 *
 *   start + years + days (calendar) + hours + minutes + seconds (elapsed) === now
 *
 * A start exactly N calendar days ago at the same wall-clock time therefore
 * reads "N days, 0 hours" on both sides of a DST change. The only oddity is
 * the 25-hour fall-back day, where the elapsed remainder can briefly read
 * 24 hours.
 *
 * A start in the future (clock skew, bad input) yields all zeros.
 */
export function computeDurationSections(
  start: Date,
  now: Date,
): DurationSection[] {
  let years = 0
  let days = 0
  let hours = 0
  let minutes = 0
  let seconds = 0

  if (!Number.isNaN(start.getTime()) && now.getTime() > start.getTime()) {
    years = differenceInYears(now, start)
    const afterYears = addYears(start, years)
    days = differenceInDays(now, afterYears)
    const afterDays = addDays(afterYears, days)
    hours = differenceInHours(now, afterDays)
    const afterHours = addHours(afterDays, hours)
    minutes = differenceInMinutes(now, afterHours)
    const afterMinutes = addMinutes(afterHours, minutes)
    seconds = differenceInSeconds(now, afterMinutes)
  }

  return [
    {
      value: Math.max(0, years),
      max: 10,
      label: "years",
      singularLabel: "year",
    },
    { value: Math.max(0, days), max: 365, label: "days", singularLabel: "day" },
    {
      value: Math.max(0, hours),
      max: 24,
      label: "hours",
      singularLabel: "hour",
    },
    {
      value: Math.max(0, minutes),
      max: 60,
      label: "minutes",
      singularLabel: "minute",
    },
    {
      value: Math.max(0, seconds),
      max: 60,
      label: "seconds",
      singularLabel: "second",
    },
  ]
}
