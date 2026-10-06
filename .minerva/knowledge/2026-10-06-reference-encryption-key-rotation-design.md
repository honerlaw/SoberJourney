# Key rotation is unsupported today; design for versioned KEK/DEK rotation

**Date**: 2026-10-06
**Type**: reference
**Theme**: encryption
**Summary**: KEK and DEKs are unversioned; rotate via versioned wrapped DEKs, unprefixed = v0.
**Context**: .minerva/work/2026-10-06-encryption-dek-cache (see git history if the worktree has been cleaned up)

## Context
Server-side field encryption (journal entries, check-in content, conversation messages) uses a two-level scheme in `packages/server/src/service/encryption/getDEK.mts`:
- **KEK** = `KEY_ENCRYPTION_KEY` config secret. A `cryptr` instance (aes-256-gcm, PBKDF2-sha512 100k iterations, random 64-byte salt per ciphertext, hex `[salt|iv|tag|ct]`) wraps each user's DEK.
- **User DEK** = 32 random bytes (hex), stored KEK-wrapped in `user_key.key` (one row per user, `userId` unique).
- **Data key** = `cryptr("<plaintext DEK>:<identifier>", pbkdf2Iterations: 1000)` where identifier is `journal` / `conversation`. Data ciphertext carries no version or key id.

Neither the wrapped DEK nor the data ciphertext is versioned, so changing `KEY_ENCRYPTION_KEY` makes every stored DEK unwrappable and therefore bricks all encrypted data. Issue #24 asked for a design note; implementation is a follow-up.

## Finding
Rotate the KEK by re-wrapping DEKs only. Data ciphertext never needs rewriting for a KEK rotation, because it is keyed by the plaintext DEK, which does not change.

1. **Version the wrapped DEK, not the data.** New wraps are stored as `v<N>:<hex>`; a value with no `v<N>:` prefix is **v0** = wrapped under the current (legacy) `KEY_ENCRYPTION_KEY`. Hex never contains `:`, so the prefix is unambiguous. Alternative: an additive nullable `kekVersion` column on `UserKey` (null = v0). This needs a Prisma migration (schema owner bucket).
2. **Config holds a keyring.** `KEY_ENCRYPTION_KEYS` = ordered `{version: secret}` plus `KEY_ENCRYPTION_KEY_CURRENT=<N>`. The existing `KEY_ENCRYPTION_KEY` is kept as v0. Unwrap selects the secret by the stored version. Wrap always uses current.
3. **Re-wrap lazily and by job.** On read (`getUserDEK`), if the stored version is not current, re-wrap with the current KEK and write it back with a compare-and-set on the old value. A one-off migration (the marker-first `runMigration` pattern in `util/migrations/runMigration.mts`) re-wraps the rest. The old KEK is retired only after a count of non-current rows reaches 0.
4. **DEK rotation (compromised user DEK) is a different, heavier operation.** It requires re-encrypting that user's data rows. If it is ever needed, add a version byte/prefix to data ciphertext (`v1:` prefix, unprefixed = v0 under DEK v0) and keep old DEKs until re-encryption completes.

## Implications
- Any rotation design must keep unversioned values decrypting as v0 (epic #34 API/data rule 6: encrypted data must stay readable).
- Do not change `KEY_ENCRYPTION_KEY` in any environment until a keyring exists. Doing so is unrecoverable data loss for every user.
- The per-request DEK memo (`getDEK.mts`) caches the unwrapped DEK per ctx, so lazy re-wrap costs at most one extra write per user per request.
- The process-level KEK cache is keyed by the secret string, so a keyring must cache one `CryptrAsync` per version.

## Related
- [[2026-10-06-decision-request-scoped-dek-memo]] — the current key scheme and per-request memo this design extends
- [[2026-10-06-pattern-marker-first-data-migrations]] — the migration pattern a bulk re-wrap job would use
