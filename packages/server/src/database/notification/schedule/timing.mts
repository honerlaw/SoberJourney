/**
 * Pure scheduling helpers for push notification schedules.
 *
 * NOTE: this module is intentionally NOT re-exported from `./index.mts`;
 * the context wraps every export of that index with (logger, client)
 * partial application, which would break these pure functions.
 */
import {
  PushNotificationStatus,
  UserPushNotificationScheduleFrequency,
} from "../../../generated/prisma/enums.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Total failed attempts allowed for one due slot before it is given up. */
const MAX_ATTEMPTS = 3;

/** Backoff after the n-th failed attempt is BACKOFF_BASE_MS * 2^(n-1). */
const BACKOFF_BASE_MS = 5 * MINUTE_MS;

/** How many of the latest notification rows listPending loads per schedule. */
export const NOTIFICATION_HISTORY_WINDOW = 30;

type Frequency = UserPushNotificationScheduleFrequency;

const FREQUENCY_DAYS: Record<Frequency, number | null> = {
  [UserPushNotificationScheduleFrequency.DAILY]: 1,
  [UserPushNotificationScheduleFrequency.WEEKLY]: 7,
  [UserPushNotificationScheduleFrequency.BIWEEKLY]: 14,
  // calendar month, see addFrequency
  [UserPushNotificationScheduleFrequency.MONTHLY]: null,
};

export type LocalDate = { year: number; month: number; day: number };

export type NotificationHistoryRow = {
  createdAt: Date;
  status: PushNotificationStatus;
  receiptId: string | null;
};

export type ScheduleTimingInput = {
  now: Date;
  createdAt: Date;
  frequency: Frequency;
  minuteOfDay: number | null;
  timezone: string;
  /** latest notification rows for the schedule, any order */
  notifications: NotificationHistoryRow[];
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    // throws a RangeError for an invalid IANA timezone
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

/**
 * The wall-clock parts of an instant in the given timezone.
 */
function getZonedParts(
  date: Date,
  timezone: string,
): LocalDate & { hour: number; minute: number; second: number } {
  const parts = getFormatter(timezone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((p) => p.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Missing ${type} while formatting date in ${timezone}`);
    }
    return parseInt(value, 10);
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // some runtimes still render midnight as 24 even with h23
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Offset (local - UTC) in ms of the timezone at the given instant.
 */
function getOffsetMs(instantMs: number, timezone: string): number {
  const p = getZonedParts(new Date(instantMs), timezone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  // drop the sub-second part of the instant so the difference is exact
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Convert a local date + minute of day in a timezone into an instant, using
 * the offset in effect at that local time (DST correct). A local time that
 * does not exist (spring-forward gap) resolves to the instant just after the
 * gap (02:30 on a 02:00→03:00 day becomes 03:30); an ambiguous local time
 * (fall-back) resolves to its first occurrence.
 */
export function zonedTimeToInstant(
  date: LocalDate,
  minuteOfDay: number,
  timezone: string,
): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  const firstOffset = getOffsetMs(guess, timezone);
  const secondOffset = getOffsetMs(guess - firstOffset, timezone);
  const candidates = [guess - firstOffset, guess - secondOffset].sort(
    (a, b) => a - b,
  );

  // a candidate is valid if it reads back as the requested local time
  const valid = candidates.filter(
    (candidate) => candidate + getOffsetMs(candidate, timezone) === guess,
  );
  if (valid.length > 0) {
    return new Date(valid[0]!);
  }

  // spring-forward gap: the later candidate is just after the gap
  return new Date(candidates[1]!);
}

function getLocalDate(date: Date, timezone: string): LocalDate {
  const { year, month, day } = getZonedParts(date, timezone);
  return { year, month, day };
}

function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Add calendar months, clamping the day to the target month's length
 * (Jan 31 + 1 month = Feb 28/29).
 */
function addMonthsClamped(date: LocalDate, months: number): LocalDate {
  const monthIndex = date.month - 1 + months;
  const year = date.year + Math.floor(monthIndex / 12);
  const month = (((monthIndex % 12) + 12) % 12) + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(date.day, daysInMonth) };
}

function addFrequency(date: LocalDate, frequency: Frequency): LocalDate {
  const days = FREQUENCY_DAYS[frequency];
  return days === null ? addMonthsClamped(date, 1) : addDays(date, days);
}

/**
 * How late a send may be and still count for the previous day's slot (a cron
 * delay or retry pushing a late-evening reminder past midnight).
 */
const LATE_SEND_GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * The local date of the daily slot a send (or given-up attempt) belongs to.
 *
 * Normally that is the local date of the send. The exception is a late send
 * that crossed midnight: a send before the slot time on its own day, within
 * LATE_SEND_GRACE_MS after the previous day's slot, belongs to the previous
 * day. Changing the reminder time therefore never double-sends or skips a
 * day: a send at 08:00 with the time moved to 21:00 counts for today, and a
 * send at 21:00 with the time moved to 08:00 counts for today as well.
 */
function getSlotDateForSend(
  instant: Date,
  minuteOfDay: number,
  timezone: string,
): LocalDate {
  const parts = getZonedParts(instant, timezone);
  const sendDate: LocalDate = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
  const sendMinute = parts.hour * 60 + parts.minute;
  if (sendMinute >= minuteOfDay) {
    return sendDate;
  }

  const previousDate = addDays(sendDate, -1);
  const previousSlot = zonedTimeToInstant(previousDate, minuteOfDay, timezone);
  const lateBy = instant.getTime() - previousSlot.getTime();
  if (lateBy >= 0 && lateBy <= LATE_SEND_GRACE_MS) {
    return previousDate;
  }
  return sendDate;
}

/**
 * The first slot at or after the schedule's creation (creation truncated to
 * the minute). A schedule created after today's time first fires on the next
 * day's slot, for every frequency.
 */
function getFirstDue(
  createdAt: Date,
  frequency: Frequency,
  minuteOfDay: number | null,
  timezone: string,
): Date {
  if (minuteOfDay === null) {
    return createdAt;
  }
  const created = Math.floor(createdAt.getTime() / MINUTE_MS) * MINUTE_MS;
  const createdDate = getLocalDate(createdAt, timezone);
  const sameDay = zonedTimeToInstant(createdDate, minuteOfDay, timezone);
  if (sameDay.getTime() >= created) {
    return sameDay;
  }
  return zonedTimeToInstant(addDays(createdDate, 1), minuteOfDay, timezone);
}

/**
 * When the schedule is next due after a send (or a given-up attempt) at
 * `lastSend`.
 */
export function getNextDue(
  lastSend: Date,
  frequency: Frequency,
  minuteOfDay: number | null,
  timezone: string,
): Date {
  if (minuteOfDay === null) {
    const days = FREQUENCY_DAYS[frequency];
    if (days !== null) {
      return new Date(lastSend.getTime() + days * DAY_MS);
    }
    const next = new Date(lastSend.getTime());
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const daysInMonth = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();
    next.setUTCDate(Math.min(day, daysInMonth));
    return next;
  }

  const slotDate = getSlotDateForSend(lastSend, minuteOfDay, timezone);
  return zonedTimeToInstant(
    addFrequency(slotDate, frequency),
    minuteOfDay,
    timezone,
  );
}

/**
 * A ticket failure: the send was rejected by Expo (or its chunk failed), so
 * no receipt exists. It is a failed attempt, not a send.
 */
function isTicketFailure(row: NotificationHistoryRow): boolean {
  return row.status === PushNotificationStatus.ERROR && row.receiptId === null;
}

/**
 * Whether a schedule should be sent now.
 *
 * - A send is any row that is not a ticket failure; the latest send drives
 *   the cadence.
 * - Ticket failures are attempts. All rows of one cron run share the run's
 *   createdAt, so one attempt = one distinct createdAt.
 * - Only attempts at/after the due slot count against it. A slot is retried
 *   with backoff until MAX_ATTEMPTS failed attempts; then it is given up and
 *   the last attempt is treated as the slot's send.
 */
export function isSchedulePending(input: ScheduleTimingInput): boolean {
  const { now, createdAt, frequency, minuteOfDay, timezone, notifications } =
    input;

  let lastSend: Date | null = null;
  const attemptTimes = new Set<number>();
  for (const row of notifications) {
    if (isTicketFailure(row)) {
      attemptTimes.add(row.createdAt.getTime());
    } else if (!lastSend || row.createdAt.getTime() > lastSend.getTime()) {
      lastSend = row.createdAt;
    }
  }

  const sortedAttempts = [...attemptTimes].sort((a, b) => a - b);

  let due = lastSend
    ? getNextDue(lastSend, frequency, minuteOfDay, timezone)
    : getFirstDue(createdAt, frequency, minuteOfDay, timezone);
  let attempts = sortedAttempts.filter((t) => t >= due.getTime());

  // give up slots that exhausted their attempts, moving on to the next slot
  while (attempts.length >= MAX_ATTEMPTS) {
    const givenUpAt = attempts[MAX_ATTEMPTS - 1]!;
    due = getNextDue(new Date(givenUpAt), frequency, minuteOfDay, timezone);
    attempts = sortedAttempts.filter(
      (t) => t > givenUpAt && t >= due.getTime(),
    );
  }

  if (now.getTime() < due.getTime()) {
    return false;
  }

  const lastAttempt = attempts[attempts.length - 1];
  if (lastAttempt === undefined) {
    return true;
  }

  const backoff = BACKOFF_BASE_MS * 2 ** (attempts.length - 1);
  return now.getTime() >= lastAttempt + backoff;
}
