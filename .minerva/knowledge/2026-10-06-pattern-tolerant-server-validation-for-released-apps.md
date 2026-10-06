# Server input validation tightens by coercing, clamping or ignoring, never by rejecting

**Date**: 2026-10-06
**Type**: pattern
**Theme**: api-compatibility
**Summary**: Tighten tRPC inputs with zod transforms and generous bounds so released apps never start failing
**Context**: .minerva/work/2026-10-06-server-hardening (see git history if the worktree has been cleaned up)

## Context
App Store builds update slowly and are pinned to whatever the server accepted when they shipped (epic #34). The server-hardening audit (#27) had to fix inputs that caused 500s or stored bad data, such as fractional `urgeStrength` against an `Int` column, unvalidated `x-iana-time-zone`, unbounded strings and future start dates, without breaking those clients.

## Finding
The tightening uses zod transforms, which change only what the server sees. tRPC clients type their calls from `z.input`, so the client contract does not change.
- `urgeStrength: z.number().min(1).max(10).transform(Math.round)`: the range check still runs first, then the value is rounded.
- Titles: `.min(1).max(1000).transform(s => s.trim() || s)`. Titles are trimmed, but a whitespace-only title is kept rather than newly rejected.
- `startDateTime`: a future date is clamped to now.
- Header values such as the timezone are validated and **ignored** when invalid. The stored value is kept and the request still succeeds.
- Length bounds are generous: journal 100k characters, title 1000, push token 4096, reorder 1000 items. All sit at or above the effective 100kb `express.json()` body cap, so nothing a real client sends is newly rejected.

## Implications
- Any future input tightening follows the same order of preference: coerce, then clamp, then ignore, and reject only as a last resort.
- A transform can still change a returned value, for example the trimmed `title` or the clamped `createdAt`. Each such change must be called out in the PR's "API contract" line.
- Client-side validation fixes are the long-term answer. The server stays tolerant for older builds.

## Related
- [[2026-10-06-decision-account-deletion-db-first-clerk-best-effort]] — same compatibility constraint applied to `user.remove`
