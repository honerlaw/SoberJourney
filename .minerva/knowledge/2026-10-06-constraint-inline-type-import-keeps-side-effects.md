# `import { type X }` still loads the module; use `import type` for context in server tests

**Date**: 2026-10-06
**Type**: constraint
**Theme**: server-conventions
**Summary**: Inline type-only imports keep a side-effect import; importing context.mts in tests crashes on config.
**Context**: .minerva/work/2026-10-06-push-notification-reliability (see git history if the worktree has been cleaned up)

## Context
Server tests run with `node --experimental-strip-types --import tsx --test`. `cron/notify.mts` had `import { type Context } from "../context.mjs"`.

## Finding
With type stripping or verbatim module syntax, `import { type X } from "m"` is emitted as `import {} from "m"`, a side-effect import. Loading `context.mts` instantiates the Clerk and Gemini clients, which call `getConfig` and throw "Failed to get config." without env vars, so the whole test file crashes. `import type { X } from "m"` is removed entirely.

## Implications
- Any server module that unit tests import should use `import type` for `Context` and other type-only imports from modules with side effects.

## Related
- [[2026-10-06-constraint-context-wraps-database-index-exports]] — same server module system
