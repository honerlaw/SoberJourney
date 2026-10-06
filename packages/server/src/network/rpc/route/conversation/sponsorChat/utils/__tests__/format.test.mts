import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatUrge } from "../formatUrge.mjs";
import { formatDuration } from "../formatDuration.mjs";
import { formatCheckInAge } from "../formatCheckInAge.mjs";
import {
  buildCurrentTimeContext,
  formatCurrentTime,
  safeTimeZone,
} from "../timeZone.mjs";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe("formatUrge (1-10 scale)", () => {
  it("maps the check-in scale to labels", () => {
    assert.equal(formatUrge(1), "none (1/10)");
    assert.equal(formatUrge(2), "mild (2/10)");
    assert.equal(formatUrge(3), "mild (3/10)");
    assert.equal(formatUrge(4), "moderate (4/10)");
    assert.equal(formatUrge(5), "moderate (5/10)");
    assert.equal(formatUrge(6), "strong (6/10)");
    assert.equal(formatUrge(7), "strong (7/10)");
    assert.equal(formatUrge(8), "intense (8/10)");
    assert.equal(formatUrge(9), "intense (9/10)");
    assert.equal(formatUrge(10), "critical (10/10)");
  });

  it("does not report a mid-scale urge of 5 as intense", () => {
    assert.ok(!formatUrge(5).startsWith("intense"));
  });

  it("handles fractional averages", () => {
    assert.equal(formatUrge(4.666666), "moderate (4.7/10)");
    assert.equal(formatUrge(9.5), "intense (9.5/10)");
  });
});

describe("formatDuration", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

  it("never says 12 months for days 360-364", () => {
    for (let d = 360; d <= 364; d++) {
      const text = formatDuration(daysAgo(d), now);
      assert.equal(text, "11 months", `day ${d}`);
    }
  });

  it("never says 'and 12 months' near the second anniversary", () => {
    assert.equal(formatDuration(daysAgo(729), now), "1 year and 11 months");
    assert.equal(formatDuration(daysAgo(725), now), "1 year and 11 months");
  });

  it("keeps the existing buckets", () => {
    assert.equal(
      formatDuration(new Date(now.getTime() - 30_000), now),
      "just started",
    );
    assert.equal(
      formatDuration(new Date(now.getTime() - 5 * 60_000), now),
      "5 minutes",
    );
    assert.equal(formatDuration(new Date(now.getTime() - HOUR), now), "1 hour");
    assert.equal(formatDuration(daysAgo(1), now), "1 day");
    assert.equal(formatDuration(daysAgo(3), now), "3 days");
    assert.equal(formatDuration(daysAgo(14), now), "2 weeks");
    assert.equal(formatDuration(daysAgo(30), now), "1 month");
    assert.equal(formatDuration(daysAgo(365), now), "1 year");
    assert.equal(formatDuration(daysAgo(400), now), "1 year and 1 month");
    assert.equal(formatDuration(daysAgo(800), now), "2 years and 2 months");
  });
});

describe("formatCheckInAge (calendar days in the user's timezone)", () => {
  const tz = "America/New_York";
  // 2026-10-06 09:00 in New York (13:00Z)
  const now = new Date("2026-10-06T13:00:00Z");

  it("says just now under an hour", () => {
    assert.equal(
      formatCheckInAge(new Date(now.getTime() - 10 * 60_000), now, tz),
      "just now",
    );
  });

  it("uses hours for earlier the same calendar day", () => {
    // 06:00 local
    assert.equal(
      formatCheckInAge(new Date("2026-10-06T10:00:00Z"), now, tz),
      "3 hours ago",
    );
  });

  it("says yesterday for the previous calendar day even if under 24h ago", () => {
    // 23:00 local the previous day, 10 hours ago
    assert.equal(
      formatCheckInAge(new Date("2026-10-06T03:00:00Z"), now, tz),
      "yesterday",
    );
  });

  it("counts calendar days, not 24h blocks", () => {
    // 2026-10-04 23:30 local = 2026-10-05T03:30Z, ~33.5h ago -> 2 calendar days
    assert.equal(
      formatCheckInAge(new Date("2026-10-05T03:30:00Z"), now, tz),
      "2 days ago",
    );
  });

  it("respects the timezone", () => {
    // 02:00Z on Oct 6 is Oct 6 in UTC but Oct 5 in New York
    const date = new Date("2026-10-06T02:00:00Z");
    assert.equal(formatCheckInAge(date, now, "UTC"), "11 hours ago");
    assert.equal(formatCheckInAge(date, now, tz), "yesterday");
  });
});

describe("timeZone helpers", () => {
  it("falls back to UTC for invalid or missing zones", () => {
    assert.equal(safeTimeZone("Not/AZone"), "UTC");
    assert.equal(safeTimeZone(""), "UTC");
    assert.equal(safeTimeZone(null), "UTC");
    assert.equal(safeTimeZone("Europe/London"), "Europe/London");
  });

  it("formats the current time in the user's zone", () => {
    const now = new Date("2026-10-06T19:04:00Z");
    const text = formatCurrentTime(now, "America/New_York");
    assert.match(text, /Tuesday, October 6, 2026/);
    assert.match(text, /3:04\sPM/);
    assert.match(text, /\(America\/New_York\)$/);
    assert.match(
      buildCurrentTimeContext(now, "UTC"),
      /Current date and time for the user: Tuesday, October 6, 2026/,
    );
  });
});
