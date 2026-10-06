# Scratchpad: journeys-journal-fixes

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [reviewed — clean] scope check: one unit, one PR, unphased (tier: reviewer — solo denied, multi-file surface; parallel wave). Skeptic accept; noted: commit verification script, note #29 permission overlap, sequence commits per concern, flag 24-hour edge — routed to whole-proposal fold / PR body.
- [reviewed — clean] approach: B — pure modules + committed tsx verification script, inline component fixes, DOM <input> web fallback (rejected: A inline-only cannot meet acceptance; C app test runner forbidden by coordinator — package-lock conflicts) (tier: reviewer — not provably small; author doubt on web <input> answered: sound, type-checks; parallel wave). Implementation notes taken: parse web input values as local time, handle "", max on date input, pure modules import only date-fns.
- [reviewed — folded] whole-proposal: Skeptic revise — committed verification script, vacuous app test criterion, reset fixture written newest-first + edge cases, non-tautological DST cases + nonexistent/repeated hour, 24-hour edge, 11:52 case, date-fns transitive note, #29 overlap note, checklist mapping + web criterion, drop BAD_REQUEST mapping (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: item 5 partially addressed (consumers TrackerCard/CurrentStreakCard tolerance of hours=24 not named) — folded: both render via clamped DurationProgressBar; also noted npm ci precondition for the script, fixed (e)/(f) ordering.

## Work notes
- Primary/epic base 3629e6e; baseline `npm run build` green in worktree.
