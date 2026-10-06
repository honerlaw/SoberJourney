# Scratchpad: 2026-10-06-encryption-dek-cache

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [reviewed — clean] scope check: single unit, one PR, no phases (tier: reviewer — fails solo single-surface clause: encryption + migrations; no panel clause; parallel wave). Skeptic accepted; noted pool-connection and rollback-sentinel points as implementation notes (folded via approach gate).
- [reviewed — folded] approach: option A (WeakMap memo per ctx + read-first + module-level CryptrAsync KEK + ctx-injectable runMigration); rejected B (field on ctx: needs context.mts owned by #27) and C (process-wide plaintext DEK LRU). Folded: two-phase migrations (prepare/encrypt outside tx, short writes-only tx), marker-insert-first serialization, runMigration never rejects and is not exported from migrations/index.mts, awaited async KEK + per-call config + test reset hook (tier: reviewer — interface-clause doubt (CryptrAsync wrapped-DEK format; execute/server.mts contract) passed to the Skeptic, answered "no existing contract changes"; parallel wave)
- [rechecked — clean] approach: fold-audit found all 7 items addressed; low new concerns (criterion 6 wording narrower than tests; Migration.name @unique — verified in schema.prisma)
- [reviewed — clean] whole-proposal: Skeptic accepted; low notes (rollback-by-throw, userKey rows outside tx, marker-last vs first) incorporated in approach text (tier: reviewer — not provably small; parallel wave). Restart check: no staleness condition fired (pick unchanged, no phase change, Goal/Success criteria not rewritten).

## Work notes
- Implemented getDEK memo as `WeakMap<ctx, Map<key, Promise>>`: `user:<id>` → plaintext DEK (shared by both identifiers), `dek:<id>:<identifier>` → data Cryptr. Rejected promises evicted.
- KEK: module-level `Cryptr.CryptrAsync`, cached keyed by secret string (getConfig resolved per call). Deviation from approach text: no test-only reset hook — keying the cache by secret makes one unnecessary (tests with different secrets get a fresh instance); criterion 3's "once per secret" is visible in code.
- Migrations split: `runMigration.mts` (ctx-injectable core; not exported from index.mts), `prepare.mts` (prepareEncryptJournalEntries / prepareEncryptConversations, one `ctx.clone` per user), `execute.mts` now a thin createContext + runMigration wrapper. Callback shape changed from `(ctx) => Promise<boolean>` to `MigrationPrepare` (internal only; server.mts still calls the zero-arg exports).
- Prisma 7 + `@prisma/adapter-pg`; `Prisma.TransactionClient` imported from generated client for the tx type. Migration.name is `@unique` (schema.prisma) — marker-first serialization relies on it.
- Key-rotation design note written to `.minerva/knowledge/2026-10-06-reference-encryption-key-rotation-design.md` (criterion 8; it is a deliverable of this unit, not a promote afterthought).
- Verified locally: `npm run build` OK, `npm run test` 20/20 pass (12 encryption, 8 migration), server eslint clean, prettier applied. App untouched (no app lint needed).
