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
- [reviewed — clean] completion verification: Verifier reproduced criteria 1-6, 9 (script 26/26, diff evidence); 7, 8, 10 unsure only because pending ship / no-build constraint (tier: reviewer floor — no interface beyond proposal)
- [solo] review triage: 5 FIX / 0 SUGGEST / 0 IGNORE (tier: default-solo row — every finding had a writable failure scenario and a small in-ownership fix; none had two defensible dispositions). No load-bearing divergence (web-time rounding criterion reworded, approach unchanged).
- [solo] promote partition: 3 PROMOTE (web datetimepicker constraint, duration-math decision, reset-history bug) / MERGE (review fixes → Approach) / DISCARD (tooling notes) (tier: default-solo row — no entry with two defensible buckets)
- [solo] TODO disposition: "add app unit-test runner" → below bar (not a defect) → recorded in the duration decision entry's Implications + PR follow-up suggestion; KeyboardAvoiding iOS double inset → unconfirmed, not high → manual-verification item in PR body; #29 permission duplication → PR note (tier: default-solo row)

## Work notes
- Primary/epic base 3629e6e; baseline `npm run build` green in worktree.
- Web datetimepicker: confirmed `@react-native-community/datetimepicker@8.4.4` `src/datetimepicker.js` (non iOS/Android/Windows) returns null + console.warn → pickers invisible on web. Fixed with a no-dep DOM `<input>` (`NotificationSettings/WebDateTimeField`).
- `@onerlaw/framework` has `frontend/utils/errors/isNotFoundError` but packages/app does not depend on the framework directly → local `isNotFoundError` helper (reads `data.code`/`shape.data.code`).
- Page-local hooks (`pages/*/hooks/*`) are inside #30 ownership; only top-level `src/hooks/*` (except useDurationSections) belong to #29.
- Verification: `TZ=America/New_York npx tsx .minerva/work/2026-10-06-journeys-journal-fixes/verify-date-math.ts` → 26 checks passed. First run tripped on sub-second remainder in the sweep (test fixture added +1234ms); recompose check now allows <1000ms remainder (seconds are whole).
- Local: `npm run build` green (server tsc + app tsc --noEmit), `npm run test` green (server 2/2; app no-op), `npx expo lint` 0 errors (3 pre-existing warnings in ConversationDrawerContent, not ours), knip output identical to baseline.
- KeyboardAvoiding: not changed — iOS double inset (KAV padding + automaticallyAdjustKeyboardInsets) plausible but needs a device; manual verification item.
- Notification permission: NotificationSettings now reads/requests permission itself before enabling (duplicates the read in #29's useExpoNotifications, which is untouched) — consolidation note for #29/#32.

## Review triage 2026-10-06
Code review (independent, unpinned): no critical/high. Findings:
1. FIX (medium) deleted-journey deep link retried 3x (~7s spinner) + reported to Sentry → `useJourneyInfo` retry skips NOT_FOUND, no report for NOT_FOUND.
2. FIX (low-med) web reminder time: per-keystroke 15-min snap breaks typing → web keeps exact minute (server accepts 0–1439; cron uses >=).
3. FIX (low) web date: per-segment clampToNow fights typing month before year → no clamp on web in commit (max + submit clamp remain).
4. FIX (low) staleTime Infinity reused the same prompt across visits → `refetchOnMount: "always"` (fresh per visit, still no mid-typing refetch).
5. FIX (low) permission-denied banner stale after OS prompt / settings change → re-check on AppState "active".
Not ours: double error toast on failed reorder (hook toast + global mutationCache handler) is pre-existing, #29 territory.
Spec audit (inline): diff matches Goal/Approach/criteria; no knowledge entries to violate (corpus empty).
