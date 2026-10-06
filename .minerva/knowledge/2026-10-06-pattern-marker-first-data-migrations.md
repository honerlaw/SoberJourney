# Startup data migrations prepare outside the tx, then insert the marker first

**Date**: 2026-10-06
**Type**: pattern
**Theme**: encryption
**Summary**: runMigration prepares outside the tx, then inserts the marker first; it never rejects.
**Context**: .minerva/work/2026-10-06-encryption-dek-cache (see git history if the worktree has been cleaned up)

## Context
`server.mts` runs `await Promise.all(Object.values(dataMigrations).map(m => m()))` before `app.listen`. The original encryption migrations had three flaws:
- They ran everything in one interactive `$transaction` with Prisma's 5s default timeout.
- They resolved the DEK per row on the pooled client while the tx held a connection.
- They wrote the `Migration` marker after the tx committed. A crash in between would re-encrypt already-encrypted rows on the next boot.

## Finding
`packages/server/src/util/migrations/runMigration.mts` (`runMigration(ctx, name, prepare)`), wrapped by `execute(name, prepare)`:
1. If the marker already exists, skip.
2. `prepare(ctx)` runs **outside any transaction**: it reads, resolves keys and encrypts, then returns `MigrationWrite[]` (or `false` to abort). Migrations clone ctx once per user, so DEKs resolve once per user.
3. One `$transaction` with an explicit timeout (5 min) and maxWait inserts the `Migration` marker **first**, then applies the writes. A concurrent migrator blocks on the `Migration.name` unique index, then gets P2002 and rolls back without touching rows. Marker and data commit atomically.
4. Writes are `updateMany` guarded on the original plaintext (`{ id, content }`), so a row edited between prepare and apply is not overwritten.
5. It never rejects. All errors are logged, and P2002 is logged at info level. The migration retries on the next boot.

## Implications
- New data migrations should follow this shape: reuse `execute` with a `prepare` function in `util/migrations/`. Export only the zero-arg wrapper from `util/migrations/index.mts`, because every value exported there is invoked at startup.
- The marker-first guarantee depends on `Migration.name @unique` in `prisma/schema/schema.prisma`.
- Prepare loads whole tables into memory, which is acceptable at current volumes. Batch it if the data grows.

## Related
- [[2026-10-06-decision-request-scoped-dek-memo]] — migrations rely on the per-ctx DEK memo for one lookup per user
