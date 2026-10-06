# Generate Prisma migrations by diffing schema directories, then verify on a scratch Postgres

**Date**: 2026-10-06
**Type**: pattern
**Theme**: server-operations
**Summary**: Use migrate diff --from-schema to write migrations without a dev DB; verify on throwaway Postgres
**Context**: .minerva/work/2026-10-06-server-hardening (see git history if the worktree has been cleaned up)

## Context
`prisma migrate dev` needs a live database and a shadow database. Agents often have neither. The local port 5432 may belong to another project. The Prisma 7 config also reads `DATABASE_URL` through `prisma.config.ts` even for `prisma format`.

## Finding
1. Copy the pre-change schema directory out of git, for example `git show HEAD:packages/server/prisma/schema/<file>` into a temp directory.
2. Run `npx prisma migrate diff --from-schema <old dir> --to-schema prisma/schema --script` and save the output, without the "Loaded Prisma config" line, as `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`.
3. Verify the result:
   - `docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=x postgres:15-alpine`
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/x npx prisma migrate deploy`
   - `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script`, which must print "This is an empty migration".
4. `npx prisma validate` and `npm run build` must pass. The build runs `prisma generate`.

## Implications
- Schema changes stay additive: indexes and new nullable columns. Released apps and existing encrypted data depend on that.
- Only one unit per parallel wave should create migrations, so their ordering never conflicts.

## Related
- [[2026-10-06-reference-server-request-pipeline]] — the server these migrations deploy with
