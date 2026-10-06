# Streak durations: calendar years/days, then elapsed hours/minutes/seconds remainder

**Date**: 2026-10-06
**Type**: decision
**Theme**: journeys-ui
**Summary**: computeDurationSections chains calendar years/days then elapsed h/m/s remainder; DST-consistent, future clamps zero.
**Context**: .minerva/work/2026-10-06-journeys-journal-fixes (see git history if the worktree has been cleaned up)

## Context
`useDurationSections` computed `days` as a calendar-day difference but `hours` as `differenceInHours(now, start) % 24`, which counts elapsed hours. After a DST change the two disagreed for one hour every day. A start exactly N days ago at the same wall-clock time showed "N days 23 hours" in spring, and a future start showed "-1 days".

## Finding
`hooks/useDurationSections/computeDurationSections.ts` (pure, `date-fns` only) derives every section from one chain:
1. years = `differenceInYears`
2. days = `differenceInDays` from start+years (calendar, local time)
3. hours, minutes and seconds = the elapsed remainder from start+years+days

So `start + y + d (calendar) + h/m/s (elapsed) == now` (to the second), and every section is ≥ 0. A start in the future (or an invalid date) yields all zeros. Accepted edge: on the 25-hour fall-back day the remainder can read **24** hours (for example 00:00→23:30 shows 24h30m). `DurationProgressBar` clamps width to [0,100], so the bar renders full rather than overflowing.

## Implications
- Both `TrackerCard` and `CurrentStreakCard` get their sections from this function. Don't reintroduce `% 24`-style math on total elapsed units.
- Verification lives in `.minerva/work/2026-10-06-journeys-journal-fixes/verify-date-math.ts`. Run it with `TZ=America/New_York npx tsx …` from the repo root, with TZ set before the process starts. The app has no unit-test runner yet.

## Related
- [[2026-10-06-bug-reset-history-assumed-oldest-first-entries]] — sibling date-derivation fix verified by the same script
