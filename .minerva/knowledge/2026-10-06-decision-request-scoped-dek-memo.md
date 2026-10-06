# Encryption keys are memoized per request on the ctx object, never process-wide

**Date**: 2026-10-06
**Type**: decision
**Theme**: encryption
**Summary**: getDEK memoizes user DEK and data Cryptrs in a WeakMap keyed by request ctx.
**Context**: .minerva/work/2026-10-06-encryption-dek-cache (see git history if the worktree has been cleaned up)

## Context
Before this change, every `encrypt`/`decrypt` call built a new KEK `Cryptr`, ran `kek.encrypt` on a throwaway DEK, upserted `user_key`, and ran `kek.decrypt`. That is two synchronous 100k-iteration PBKDF2s plus a DB write per row. Listing 300 journal entries blocked the Node event loop for seconds. `cryptr` derives a key from a fresh random salt for **every** ciphertext, so caching a `Cryptr` instance saves construction but never the per-value PBKDF2.

## Finding
`packages/server/src/service/encryption/getDEK.mts` keeps a module-level `WeakMap<ctx, Map<string, Promise>>`:
- `user:<userId>` holds the plaintext user DEK. It costs one `userKey.findUnique` and one KEK unwrap per request, shared by every identifier.
- `dek:<userId>:<identifier>` holds the sync data `Cryptr`, returned by the public `getDEK`.
- `async-dek:<userId>:<identifier>` holds the `Cryptr.CryptrAsync` data key used by `encrypt`/`decrypt`. Per-value PBKDF2 (1000 iterations) runs on the libuv threadpool.

The memo caches promises, so concurrent `Promise.all` calls collapse into one lookup. Rejected promises are evicted. A key is read first and only generated and inserted when missing. A null upsert (swallowed P2002 race) triggers a re-read. The KEK is a module-level `CryptrAsync` cached by secret string.

A process-wide plaintext-DEK cache was rejected. It keeps key material across requests and users and needs invalidation on user deletion.

## Implications
- The memo is only as good as ctx identity: tRPC builds one ctx per HTTP request. `ctx.clone()` (used by migrations) starts a fresh scope. Spreading or re-creating ctx mid-request silently defeats the cache.
- Inner keys include `userId`, so a ctx never serves another user's DEK.
- **Ciphertext format is a released contract** (epic #34 rule 6). It covers aes-256-gcm, PBKDF2-sha512, 64-byte salt, the hex `[salt|iv|tag|ct]` layout, KEK at 100k iterations, and the data key `"<dek>:<identifier>"` at 1000 iterations. `Cryptr` and `CryptrAsync` are byte-identical. Tests in `service/encryption/__tests__/index.test.mts` cross-check against the legacy algorithm in both directions.
- The remaining per-request cost is one async 100k-iteration KEK unwrap per user, plus one async 1000-iteration PBKDF2 per row.

## Related
- [[2026-10-06-reference-encryption-key-rotation-design]] — rotation design builds on this scheme and memo
