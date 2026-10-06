# @react-native-community/datetimepicker renders nothing on web

**Date**: 2026-10-06
**Type**: constraint
**Theme**: journeys-ui
**Summary**: Native datetimepicker returns null on web; use NotificationSettings/WebDateTimeField (DOM input) there.
**Context**: .minerva/work/2026-10-06-journeys-journal-fixes (see git history if the worktree has been cleaned up)

## Context
The web build (react-native-web, served by the same server) showed no start-date picker on New Journey and no reminder-time picker in NotificationSettings. Issue #30 asked to verify.

## Finding
`@react-native-community/datetimepicker@8.4.4` ships implementations only for iOS, Android and Windows. Its fallback `src/datetimepicker.js` returns `null` after a `console.warn("DateTimePicker is not supported on: web")`. The app now branches on `Platform.OS === "web"` and renders `components/NotificationSettings/WebDateTimeField`, a dependency-free DOM `<input type="date|time">` created through react-native-web (`React.createElement("input", …)`, plain CSS style object). It parses values by hand as local time, because `new Date("yyyy-MM-dd")` is UTC and shifts the day west of Greenwich, and it ignores a cleared value.

## Implications
- Any new date/time picker must handle web separately. Reuse `WebDateTimeField` rather than adding a picker dependency.
- `minuteInterval` and `maximumDate` don't carry over automatically. Pass `minuteInterval` (maps to `step`) and `maximumDate` (maps to `max`).
- Browser date/time inputs fire `onChange` per typed segment. Don't snap or clamp on every change, because it resets segment entry (for example, typing the month before the year). Clamp at submit instead: the web reminder time keeps the exact minute, and the New Journey start date is clamped in `onCreate`.
- `@react-native-community/datetimepicker` also ignores `minuteInterval` on Android, so any minute can reach `dateToMinuteOfDay`.

## Related
- [[2026-10-06-decision-duration-display-calendar-days-plus-elapsed-remainder]] — same journey UI date/time surface
