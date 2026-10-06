# Wrapped database/datasource index modules must export functions only

**Date**: 2026-10-06
**Type**: constraint
**Theme**: server
**Summary**: context.mts wrap() partially applies every index export; import Context with `import type`
**Context**: .minerva/work/2026-10-06-sponsor-chat-backend (see git history if the worktree has been cleaned up)

## Context
`packages/server/src/context.mts` builds `ctx.database.*` and `ctx.datasource.*` with
`wrap(client, wrap(logger, module))` from `@onerlaw/framework/backend/utils`, which maps every
key of the module object to `(...args) => fn(dependency, ...args)`.

## Finding
Every export of a wrapped index file (`database/<name>/index.mts`, `datasource/<name>/index.mts`)
becomes a partially-applied function, so those files must re-export functions only. Classes,
constants and helpers (e.g. `GeminiError`, `classifyResponse`, `GEMINI_TIMEOUT_MS`) are imported
directly from their module file. New functions placed in a wrapped module appear on `ctx`
automatically, without editing `context.mts`, as long as their signature starts with
`(logger, client, ...)`.

Under `verbatimModuleSyntax`, `import { type Context } from ".../context.mjs"` still emits a
side-effect import, which boots config/Clerk/Gemini clients and fails in tests without env
vars. Modules that tests import must use `import type { Context }`.

## Implications
- Tests can exercise route logic by extracting it into a plain function taking `ctx`
  (e.g. `runSponsorChat`) or via `router({...}).createCaller(ctx)`; `router.mts` imports
  `Context` type-only.

## Related
- [[2026-10-06-reference-released-app-compatibility]] — the other server-wide constraints this unit relied on
