# Proposal: 2026-10-06-encryption-dek-cache

**Date**: 2026-10-06
**Status**: Shipped (2026-10-06)
**Closes**: #24

## Goal
Make server-side field encryption cheap per request and make the startup data migrations crash-safe, without changing the ciphertext format or the public `encrypt(ctx, identifier, data)` / `decrypt(ctx, identifier, data)` / `getDEK(ctx, identifier)` signatures, so callers in other buckets (journal, checkin, conversation routes) need no edits and every existing row still decrypts.

## Why
Today every `encrypt`/`decrypt` call: constructs a new KEK `Cryptr`, speculatively `kek.encrypt`s a random temp DEK (100k-iteration sync PBKDF2), does a `userKey.upsert` DB round-trip, then `kek.decrypt`s the stored key (another 100k-iteration sync PBKDF2). Listing 300 journal entries or loading a 150-message conversation therefore runs ~600 blocking PBKDF2s + N DB writes, stalling the Node event loop for seconds for every user on the instance. The startup migrations wrap everything in one interactive `$transaction` with Prisma's 5s default timeout, call `ctx.clone` + `getDEK` per row, and write the `Migration` marker outside the transaction, so a crash between commit and marker write would re-encrypt already-encrypted rows on next boot (double encryption = data loss).

## Approach
What shipped (all inside `packages/server/src/service/encryption/**` and `packages/server/src/util/migrations/**`; no caller, context, schema or tRPC change):

1. **Request-scoped memo (`getDEK.mts`).** A module-level `WeakMap<ctx, Map<string, Promise>>` keyed by the request ctx object. `user:<userId>` holds the plaintext user DEK: one `userKey.findUnique` and one KEK unwrap per request, shared by both identifiers. `dek:<userId>:<identifier>` holds the sync data `Cryptr` returned by the public `getDEK`. `async-dek:<userId>:<identifier>` holds the `Cryptr.CryptrAsync` data key used by `encrypt`/`decrypt`, so per-row PBKDF2 (1000 iterations, the per-ciphertext salt makes this unavoidable) runs on the libuv threadpool. Promises are memoized so concurrent calls collapse. Rejections are evicted. Nothing outlives the ctx. tRPC builds one ctx per HTTP request, and `ctx.clone` starts a fresh scope. The alternatives were a field on ctx (would need `context.mts`, owned by #27) and a process-wide plaintext-DEK LRU (key material across requests). Both were rejected.
2. **Read first, create only when missing.** `ctx.database.client.userKey.findUnique`. Only when no row exists: generate 32 random bytes, `await kek.encrypt`, then the existing `ctx.database.user.key.upsert` (create-or-return-existing). If that returns null (it swallows errors such as a P2002 race), re-read. If the row is still missing, throw "Failed to create or read user key".
3. **KEK at module level, async.** `Cryptr.CryptrAsync`, cached by secret string (`getConfig` resolved per call; never read at import time). Its format is byte-identical to the previous sync `Cryptr`. There is no test-only reset hook: keying by secret made one unnecessary.
4. **Migrations.** `runMigration(ctx, name, prepare)` in `runMigration.mts` is not exported from `index.mts`. `execute(name, prepare)` is a thin `createContext` wrapper. The steps:
   - Skip if the marker exists.
   - `prepare` runs outside any transaction. In `prepare.mts`, one `ctx.clone` per user, so the DEK resolves once per user. It returns the write list.
   - One `$transaction` (timeout 5 min, maxWait 30 s) inserts the `Migration` marker **first**, then applies the writes. Writes are `updateMany` guarded on `{ id, content: <original plaintext> }`.
   - `runMigration` never rejects. P2002 means another instance won the marker race and is logged at info level; everything else is logged at error level and retried on the next boot.
   - The `encryptJournalEntries()` and `encryptConversations()` zero-arg exports are unchanged for `server.mts`.
5. **Tests.** `service/encryption/__tests__/index.test.mts` (13): the flaky timing assertion was replaced. The tests cover:
   - memoization (50 decrypts give 1 lookup and 0 upserts)
   - concurrent first use
   - an existing key with no upsert
   - a new request getting a new lookup
   - per-user scoping
   - the race re-read
   - failure eviction
   - KEK built once
   - legacy-format cross-decrypt in both directions

   `util/migrations/__tests__/runMigration.test.mts` (8) covers:
   - marker skip
   - ordering (prepare, then begin, then marker, then writes, then commit), and the timeout
   - abort, a throw in prepare, a throw in a write
   - a real `PrismaClientKnownRequestError` P2002
   - per-user DEK resolution and guarded writes for both encryption migrations
6. **Key rotation**: design note only, in `.minerva/knowledge/2026-10-06-reference-encryption-key-rotation-design.md`.

## Success criteria
1. Decrypting N items for one identifier within one ctx performs exactly 1 user-key DB lookup and 0 upserts when the key exists — asserted by a test.
2. Concurrent first-use calls in one ctx produce at most 1 upsert; a null upsert result triggers a re-read — tested.
3. No `kek.encrypt`/upsert when the user key already exists; the KEK Cryptr is constructed once per process (per secret) — visible in code and covered by the call-count and KEK-construction tests.
4. Ciphertext format unchanged: a legacy-format fixture decrypts with new code and new ciphertext decrypts with the legacy algorithm — tested.
5. `encrypt`/`decrypt`/`getDEK`/`DEKIdentifier` exports and signatures unchanged; no file outside `service/encryption/**` and `util/migrations/**` changes (besides `.minerva/`).
6. Migrations: marker is written inside the same transaction as the data updates, explicit transaction timeout, DEK resolved once per user — tested via `runMigration` unit tests.
7. The `<1ms avg` timing assertion is gone; `npm run build`, `npm run test`, and server lint pass.
8. A key-rotation design note exists in `.minerva/knowledge/`.

## Open Questions
- None blocking. (Whether a process-wide DEK cache is wanted is deferred to profiling.)
