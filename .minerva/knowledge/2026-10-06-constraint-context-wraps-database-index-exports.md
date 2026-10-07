# Every export of a wrapped database/datasource index becomes a (logger, client)-bound ctx function

**Date**: 2026-10-06
**Type**: constraint
**Theme**: server-conventions
**Summary**: context.mts partially applies (logger, client) to every index export; keep pure helpers out.
**Context**: .minerva/work/2026-10-06-push-notification-reliability (see git history if the worktree has been cleaned up)

## Context
`packages/server/src/context.mts` builds `ctx.database.*` and `ctx.datasource.*` with `wrap(client, wrap(logger, module))` from `@onerlaw/framework`, applied to each `index.mts` namespace import.

## Finding
Every function exported from those index modules is called by the context with `(logger, client, ...args)`. A pure helper or constant exported from an index would be wrapped and broken. Keep such helpers in sibling modules that the index does not re-export, and import them directly. Examples: `schedule/timing.mts`, and the constants in `datasource/expo/notify.mts`, which the index does not re-export.

## Implications
- New database functions must take `(logger, client, ...)` as their first parameters to appear correctly on `ctx`.
- Adding optional trailing parameters (e.g. `listPending(now?)`, `create(..., createdAt?)`) is safe for existing ctx callers.

## Related
- [[2026-10-06-constraint-inline-type-import-keeps-side-effects]] — the other server module gotcha found in this unit
