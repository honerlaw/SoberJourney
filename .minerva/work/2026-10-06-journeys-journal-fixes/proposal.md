# Proposal: journeys-journal-fixes

**Date**: 2026-10-06
**Status**: Draft
**Closes**: #30

## Goal
Fix the journey, check-in and journal page bugs listed in GitHub issue #30 (reset history, reminder-time rounding, future start dates, DST duration math, reorder rollback, crash/validation/navigation bugs, calendar heatmap, prompt churn, double submits, notification permission state, web date pickers, useFocusEffect stability), client-only, inside #30's file ownership, against the unchanged production server API.

## Why
These are user-visible correctness bugs on the app's core screens: the Reset History tab hides the most recent reset and invents a fake "Reset #1 — 0 days"; a 9:53 reminder silently becomes 9:00; future start dates render "-1 days" and negative bars; the streak display is off by a day for an hour daily after DST changes; failed operations leave the UI lying (reorder not rolled back, journal page navigates back after a failed delete); the Edit Journey screen can crash; date/time pickers render nothing on web.

## Approach
Extract the date/derivation logic into **pure, dependency-light modules** (only `date-fns`, already used) so the acceptance-criteria cases are verified by a committed script under the unit's `.minerva/work/` directory, run with the root-hoisted `tsx` (no test runner or dependency added to packages/app — package-lock conflicts with 6 sibling PRs; "add an app unit-test runner" becomes a follow-up). The pure modules import only `date-fns` (transitively hoisted at the root, not declared in packages/app/package.json — pre-existing, left as is) and never each other. Component fixes are made in place.

Pure modules (new files, inside owned dirs):
- `hooks/useDurationSections/computeDurationSections.ts` — `computeDurationSections(start, now)`: years (calendar) → days (calendar, `differenceInDays` from start+years) → hours/minutes/seconds as the elapsed remainder from start+years+days. One chained computation, so `start + years + days + h/m/s == now` (invariant). Clamped: if `now < start` all sections are 0. `useDurationSections` calls it. Hours can read 24 only during a 25-hour fall-back day (honest elapsed remainder); documented in code and the PR body.
- `components/pages/JourneyInfoPage/utils/deriveResetHistory.ts` — sorts entries newest-first defensively, returns `{ startEntry, currentEntry, resets[] }` where `resets` = every entry except the oldest (the journey start), each with `resetAt`, `previousAt` (the next-older entry), and `number` (1 = oldest reset). `JourneyInfoPage` + `ResetHistoryCard` consume it.
- `components/NotificationSettings/utils/dateToMinuteOfDay.ts` — round total minutes-of-day to 15 and wrap modulo 1440 (9:53→10:00, 23:53→00:00).
- `components/pages/JourneyInfoPage/utils/isNotFoundError.ts` — defensively reads `error.data.code` / `error.shape.data.code` and detects tRPC `NOT_FOUND` (what `journey.get` throws for a missing/deleted journey) so a deep link to a deleted journey shows `JourneyNotFoundView`. `BAD_REQUEST` is not mapped (could mask real errors).

Component fixes (issue checklist → file):
- Future start dates: `maximumDate={now}` on the date picker; date/time handlers clamp a future result to now (`DateTimeInput`); `DurationProgressBar` clamps width to [0,100].
- "Now" start: `NewJourneyPage` keeps `startDate: Date | null` (null = now) resolved at submit; a "Use current time" control returns to Now after opening the picker.
- Reorder rollback: `DashboardPage` restores the server order when `reorderJourneys` returns false; `isDragging` cleared in `finally`.
- `ModifyJourneyPage`: `currentTitle ?? ""`, prefill from `useJourneyInfo` when the param is missing; trimmed-empty guard.
- `JournalEntryInfoPage`: `router.back()` only on successful delete.
- `NewJourneyPage`: disable + guard on trimmed-empty title; send trimmed title.
- Double-submit guards: ref-based in-flight guard on New Journey, Modify Journey, New Check-in, New Journal Entry, journal delete.
- Calendar heatmap: cap level at `$color7` (`min(count,5)+2`); tapping an adjacent-month day switches the visible month.
- Prompt churn: `journal.entryPrompt` queried with `staleTime: Infinity` and no focus/reconnect refetch (MicroJournal + NewJournalEntryPage).
- Notification permission (does not call, modify or re-export #29's `useExpoNotifications`; the duplicated permission read is noted on the PR/#29 for later consolidation): on native, toggling reminders on checks/requests permission via `expo-notifications` inside `NotificationSettings`; if not granted the switch stays off and a toast explains; an inline note shows when saved settings are enabled but OS permission is denied. Web unchanged (no web push path).
- Web pickers: verified `@react-native-community/datetimepicker@8.4.4` has no web implementation (`src/datetimepicker.js` returns null + console.warn on non-iOS/Android/Windows). Add a no-dependency web fallback component `components/NotificationSettings/WebDateTimeField/` (owned dir; imported by `NewJourneyPage/DateTimeInput`) rendering a DOM `<input type="date|time">` via react-native-web, used by `DateTimeInput` and `NotificationSettings` when `Platform.OS === "web"`.
- `useFocusEffect` callbacks wrapped in `useCallback` in the 5 page-local hooks (`useJourneyList`, `useJournalList`, `useJourneyInfo`, `useCheckIns`, `useJournalEntryInfo`).
- `KeyboardAvoiding` iOS double-inset: needs on-device verification; no blind change — listed under manual verification / follow-up.

Not touched: server, shared `hooks/*` other than `useDurationSections` (#29 owns `useToastError`, `useExpoNotifications`), any tRPC procedure. API contract unchanged.

## Success criteria
- A committed verification script `.minerva/work/2026-10-06-journeys-journal-fixes/verify-date-math.ts` (run from the worktree root after `npm ci`, with `TZ=America/New_York npx tsx <path>`, TZ set in the environment before the process starts) imports the pure modules directly and asserts every case below with `node:assert`; it exits 0. Its cases and output are pasted into the PR body. This stands in for issue #30's "Unit tests" acceptance line (an app test runner is out of bounds for this wave); the PR body states that deviation explicitly and an "add app unit test runner" follow-up is recorded.
- `deriveResetHistory` (server order is newest-first, `createdAt desc`): for input `[r2, r1, start]` it returns `startEntry = start`, `currentEntry = r2`, and `resets = [{entry r2, previous r1, number 2}, {entry r1, previous start, number 1}]`; the same output for a shuffled input; a 1-entry journey `[start]` gives `resets = []` (empty state, no fake "Reset #1"); a 0-entry input gives `startEntry`/`currentEntry` undefined and `resets = []`; equal `createdAt` ties break deterministically by id. `JourneyInfoPage` shows total resets = `resets.length`.
- `dateToMinuteOfDay`: 9:53→600, 9:07→540, 9:08→555, 11:52→705, 12:22→735, 23:53→0, 0:00→0.
- `computeDurationSections` with `TZ=America/New_York`: (a) a start exactly N calendar days before `now` at the same wall-clock time yields days=N, hours=minutes=seconds=0 for starts before and `now` after the 2026-03-08 and 2026-11-01 transitions (the case the old `%24` math got wrong by 1 hour); (b) a start 1 year + 2 days + 3h4m5s before now (calendar arithmetic) yields exactly those sections; (c) every section is ≥ 0 and `addSeconds(addMinutes(addHours(addDays(addYears(start, y), d), h), m), s)` equals `now` (calendar arithmetic, not ms addition); (d) a future start yields all zeros; (e) starts adjacent to the skipped spring-forward hour (2026-03-08 01:30) and inside the repeated fall-back hour (2026-11-01 01:30 EDT) produce non-negative sections that recompose to `now`; (f) hours ≤ 23 except on the 25-hour fall-back day where up to 24 is allowed and asserted for one explicit case (documented). Both section consumers (`TrackerCard`, `CurrentStreakCard`) render through `DurationProgressBar`, whose width is clamped to [0,100], so a 24 on a `max: 24` bar renders full, not overflowing.
- Future start date cannot be committed: native date picker gets `maximumDate` = a fresh `new Date()` at render, date/time handlers clamp a future result to the current time at pick time, web inputs carry `max`; `DurationProgressBar` width is clamped to [0,100] (code).
- Web: on `Platform.OS === "web"`, the start-date picker and the reminder-time picker render a DOM `<input type="date">` / `<input type="time">` (from a new component inside an owned dir), parsed as local time, empty value ignored, time rounded via `dateToMinuteOfDay`.
- The PR body carries a checklist-to-file mapping covering every issue #30 checklist item, with KeyboardAvoiding explicitly deferred to on-device verification.
- `npm run build` (server tsc + prisma generate + app `tsc --noEmit`) green from the worktree root; `npm run test` stays green (server tests; note: the app `test` script is a no-op, so it proves nothing for this unit — the verification script is the real check); `npx expo lint` in packages/app shows no new errors in touched files.
- No file outside #30's ownership list is modified (except `.minerva/` records); `useExpoNotifications`/`useToastError` untouched; no new npm dependency and no package.json/package-lock change; no server/tRPC change.
- PR body lists manual test steps for iOS, Android and web.

## Open Questions
- None blocking. KeyboardAvoiding double-inset requires a device; deferred to manual verification.
