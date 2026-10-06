# Proposal: journeys-journal-fixes

**Date**: 2026-10-06
**Status**: Shipped (2026-10-06)
**Closes**: #30

## Goal
Fix the journey, check-in and journal page bugs listed in GitHub issue #30 (reset history, reminder-time rounding, future start dates, DST duration math, reorder rollback, crash/validation/navigation bugs, calendar heatmap, prompt churn, double submits, notification permission state, web date pickers, useFocusEffect stability), client-only, inside #30's file ownership, against the unchanged production server API.

## Why
These are user-visible correctness bugs on the app's core screens: the Reset History tab hides the most recent reset and invents a fake "Reset #1 — 0 days"; a 9:53 reminder silently becomes 9:00; future start dates render "-1 days" and negative bars; the streak display is off by a day for an hour daily after DST changes; failed operations leave the UI lying (reorder not rolled back, journal page navigates back after a failed delete); the Edit Journey screen can crash; date/time pickers render nothing on web.

## Approach
What shipped (client-only, inside #30's ownership, no new dependency, tRPC API unchanged):

**Pure modules** (import only `date-fns`, transitively hoisted at the root and not declared in packages/app/package.json; this is pre-existing and was left as is). They are verified by the committed `verify-date-math.ts` in this directory: `TZ=America/New_York npx tsx …` gives 26 checks passed. packages/app still has no test runner, so this stands in for #30's "unit tests" line; adding a runner is a follow-up suggestion.
- `hooks/useDurationSections/computeDurationSections.ts`: years and days as calendar units, then hours, minutes and seconds as the elapsed remainder, all from one chain. Every section is ≥ 0, and a future start gives zeros. The 25-hour fall-back day can read 24h, which is documented. `useDurationSections` delegates to it.
- `pages/JourneyInfoPage/utils/deriveResetHistory.ts`: order-independent and newest-first. Resets are every entry except the oldest, each with `previousAt` and `number`. `JourneyInfoPage` and `ResetHistoryCard` consume it.
- `NotificationSettings/utils/dateToMinuteOfDay.ts`: rounds the total minute of day to 15 and wraps mod 1440.
- `pages/JourneyInfoPage/utils/isNotFoundError.ts`: tRPC `NOT_FOUND` via `data.code` or `shape.data.code`. A deleted-journey deep link renders `JourneyNotFoundView`, and `useJourneyInfo` neither retries nor reports NOT_FOUND.

**Component fixes**
- Future start dates: the native date picker gets `maximumDate` (a fresh `new Date()`), and native picks are clamped to now. The web date input gets `max`, and the start is clamped at submit. `DurationProgressBar` width is clamped to [0,100].
- New Journey: `startDate` is `null` for "Now" and is resolved at submit. A "Use current time instead" button resets it. A trimmed-empty title disables the button and is guarded on submit.
- Dashboard reorder: on failure it rolls back to the last server order, and `isDragging` is cleared in `finally`.
- Modify Journey: uses `currentTitle ?? ""`, prefills from `journey.get` when the param is missing, sends a trimmed title, and guards against an empty one.
- Journal entry: navigates back only after a successful delete.
- Ref-based double-submit guards on New Journey, Modify Journey, New Check-in, New Journal Entry and journal delete.
- Calendar heatmap: capped at `$color7`. Tapping an adjacent-month day switches the visible month.
- `journal.entryPrompt`: `staleTime: Infinity`, `refetchOnMount: "always"`, and no focus or reconnect refetch. That gives a fresh prompt per visit that never changes mid-typing.
- Notification permission, on native only: `NotificationSettings` checks or requests permission before enabling reminders. If denied, the switch stays off and a toast explains why. A "blocked" note appears when the setting is on but the OS permission is denied, and it is re-checked whenever the app becomes active. #29's `useExpoNotifications` is untouched; its permission read now duplicates this one.
- Web pickers: `@react-native-community/datetimepicker` renders null on web, so a new `NotificationSettings/WebDateTimeField` renders a DOM `<input type="date|time">` with local-time parsing. Web input is not snapped or clamped per keystroke, because doing so broke segment entry (review findings 2 and 3).
- `useFocusEffect` callbacks are wrapped in `useCallback` in the 5 page-local hooks.
- `KeyboardAvoiding`: not changed. The iOS double inset is left for on-device manual verification.

## Success criteria
- A committed verification script `.minerva/work/2026-10-06-journeys-journal-fixes/verify-date-math.ts` (run from the worktree root after `npm ci`, with `TZ=America/New_York npx tsx <path>`, TZ set in the environment before the process starts) imports the pure modules directly and asserts every case below with `node:assert`; it exits 0. Its cases and output are pasted into the PR body. This stands in for issue #30's "Unit tests" acceptance line (an app test runner is out of bounds for this wave); the PR body states that deviation explicitly and an "add app unit test runner" follow-up is recorded.
- `deriveResetHistory` (server order is newest-first, `createdAt desc`): for input `[r2, r1, start]` it returns `startEntry = start`, `currentEntry = r2`, and `resets = [{entry r2, previous r1, number 2}, {entry r1, previous start, number 1}]`; the same output for a shuffled input; a 1-entry journey `[start]` gives `resets = []` (empty state, no fake "Reset #1"); a 0-entry input gives `startEntry`/`currentEntry` undefined and `resets = []`; equal `createdAt` ties break deterministically by id. `JourneyInfoPage` shows total resets = `resets.length`.
- `dateToMinuteOfDay`: 9:53→600, 9:07→540, 9:08→555, 11:52→705, 12:22→735, 23:53→0, 0:00→0.
- `computeDurationSections` with `TZ=America/New_York`: (a) a start exactly N calendar days before `now` at the same wall-clock time yields days=N, hours=minutes=seconds=0 for starts before and `now` after the 2026-03-08 and 2026-11-01 transitions (the case the old `%24` math got wrong by 1 hour); (b) a start 1 year + 2 days + 3h4m5s before now (calendar arithmetic) yields exactly those sections; (c) every section is ≥ 0 and `addSeconds(addMinutes(addHours(addDays(addYears(start, y), d), h), m), s)` equals `now` (calendar arithmetic, not ms addition); (d) a future start yields all zeros; (e) starts adjacent to the skipped spring-forward hour (2026-03-08 01:30) and inside the repeated fall-back hour (2026-11-01 01:30 EDT) produce non-negative sections that recompose to `now`; (f) hours ≤ 23 except on the 25-hour fall-back day where up to 24 is allowed and asserted for one explicit case (documented). Both section consumers (`TrackerCard`, `CurrentStreakCard`) render through `DurationProgressBar`, whose width is clamped to [0,100], so a 24 on a `max: 24` bar renders full, not overflowing.
- Future start date cannot be committed: native date picker gets `maximumDate` = a fresh `new Date()` at render, date/time handlers clamp a future result to the current time at pick time, web inputs carry `max`; `DurationProgressBar` width is clamped to [0,100] (code).
- Web: on `Platform.OS === "web"`, the start-date picker and the reminder-time picker render a DOM `<input type="date">` / `<input type="time">` (from a new component inside an owned dir), parsed as local time, empty value ignored; the web reminder time keeps the minute as typed (per-keystroke 15-minute snapping broke browser segment entry — review finding 2) and the web start date is clamped at submit rather than per segment (review finding 3).
- The PR body carries a checklist-to-file mapping covering every issue #30 checklist item, with KeyboardAvoiding explicitly deferred to on-device verification.
- `npm run build` (server tsc + prisma generate + app `tsc --noEmit`) green from the worktree root; `npm run test` stays green (server tests; note: the app `test` script is a no-op, so it proves nothing for this unit — the verification script is the real check); `npx expo lint` in packages/app shows no new errors in touched files.
- No file outside #30's ownership list is modified (except `.minerva/` records); `useExpoNotifications`/`useToastError` untouched; no new npm dependency and no package.json/package-lock change; no server/tRPC change.
- PR body lists manual test steps for iOS, Android and web.

## Open Questions
- None blocking. KeyboardAvoiding double-inset requires a device; deferred to manual verification.
