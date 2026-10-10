# Server checks in a fresh minerva worktree need Prisma codegen first, and knip there is unreliable

**Date**: 2026-10-10
**Type**: constraint
**Theme**: server-operations
**Summary**: Run codegen with a placeholder DATABASE_URL before server tests; run knip from the main checkout
**Context**: .minerva/work/2026-10-10-sponsor-chat-abuse-hardening (see git history if the worktree has been cleaned up)

## Context
Work units are implemented in `.minerva/worktrees/<date-slug>/`, a fresh checkout with no generated files
and no `.env`.

## Finding
- Any server test that imports `util/database.mts` fails with `ERR_MODULE_NOT_FOUND …/src/generated/prisma/client.js`
  until the Prisma client is generated. `prisma.config.ts` refuses to load without `DATABASE_URL`, so run
  `DATABASE_URL=postgresql://x:x@localhost:5432/x npm run codegen` in `packages/server` (after `npm ci` at
  the root). CI does the same by writing a placeholder into `packages/server/.env`.
- `npx knip` run inside the worktree reports ~34 "unused files" including `src/server.mts`: the worktree
  sits under `.minerva/worktrees/`, which the repo root `.gitignore` ignores, and knip's gitignore handling
  drops the entry files. Its output there is not comparable with main. Compare by running knip in the main
  checkout instead (or grep the worktree output only for the new symbols). CI does not run knip.

## Implications
- Budget a codegen step when verifying server work in a worktree; a red test run that fails at import time
  is this, not a code bug.
- Do not trust or "fix" knip findings produced inside `.minerva/worktrees/`.

## Related
- [[2026-10-06-pattern-prisma-migration-without-live-db]] — the other place the server toolchain works without a live database
