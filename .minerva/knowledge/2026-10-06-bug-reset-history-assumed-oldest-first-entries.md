# Reset History sliced newest-first entries as if they were oldest-first

**Date**: 2026-10-06
**Type**: bug
**Theme**: journeys-ui
**Summary**: journey.get entries are newest-first; deriveResetHistory treats all but the oldest as resets.
**Context**: .minerva/work/2026-10-06-journeys-journal-fixes (see git history if the worktree has been cleaned up)

## Context
A journey has one `entries` row for its start plus one per reset. `journey.get` returns them ordered `createdAt desc` (`packages/server/src/database/journey/get.mts`).

## Finding
`JourneyInfoPage` used `entries.slice(1)` as the resets, and `ResetHistoryCard` used `entries[index + 2]` as each reset's previous entry. With newest-first data, that dropped the most recent reset and listed the journey start as a fake "Reset #1 — 0 days". The fix is a pure `JourneyInfoPage/utils/deriveResetHistory.ts`:
- It sorts defensively (newest first, with ties broken by id).
- `startEntry` = the oldest entry, and `currentEntry` = the newest.
- `resets` = every entry except the oldest. Each reset carries `previousAt` (the next-older entry) and `number` (1 = oldest).
- The total resets count is `resets.length`.

## Implications
- Don't index `journey.entries` positionally in UI code. Go through `deriveResetHistory`, which does not depend on input order.
- A journey with only its start entry has zero resets and shows the empty state.

## Related
- [[2026-10-06-decision-duration-display-calendar-days-plus-elapsed-remainder]] — the current streak uses `currentEntry` from this derivation
