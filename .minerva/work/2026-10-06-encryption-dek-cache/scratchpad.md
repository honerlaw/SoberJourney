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
- [reviewed — clean] completion verification: Verifier reproduced all 8 criteria (tests re-run 20/20, eslint/tsc clean); noted criterion 3's KEK-once claim is visible in code only, not test-asserted (tier: reviewer floor — no interface change beyond what the proposal approved)
- [solo] review triage: 5 FIX / 0 SUGGEST / 1 IGNORE (tier: default-solo row — every finding had one dominant disposition by the deferral bar: writable failure scenario + absorbable → FIX; no item had two defensible dispositions)


## Work notes
- Implemented getDEK memo as `WeakMap<ctx, Map<key, Promise>>`: `user:<id>` → plaintext DEK (shared by both identifiers), `dek:<id>:<identifier>` → data Cryptr. Rejected promises evicted.
- KEK: module-level `Cryptr.CryptrAsync`, cached keyed by secret string (getConfig resolved per call). Deviation from approach text: no test-only reset hook — keying the cache by secret makes one unnecessary (tests with different secrets get a fresh instance); criterion 3's "once per secret" is visible in code.
- Migrations split: `runMigration.mts` (ctx-injectable core; not exported from index.mts), `prepare.mts` (prepareEncryptJournalEntries / prepareEncryptConversations, one `ctx.clone` per user), `execute.mts` now a thin createContext + runMigration wrapper. Callback shape changed from `(ctx) => Promise<boolean>` to `MigrationPrepare` (internal only; server.mts still calls the zero-arg exports).
- Prisma 7 + `@prisma/adapter-pg`; `Prisma.TransactionClient` imported from generated client for the tx type. Migration.name is `@unique` (schema.prisma) — marker-first serialization relies on it.
- Key-rotation design note written to `.minerva/knowledge/2026-10-06-reference-encryption-key-rotation-design.md` (criterion 8; it is a deliverable of this unit, not a promote afterthought).
- Verified locally: `npm run build` OK, `npm run test` 20/20 pass (12 encryption, 8 migration), server eslint clean, prettier applied. App untouched (no app lint needed).

## Review triage 2026-10-06
Code review (independent diff reviewer; no PR yet) found 0 critical/high/medium, 6 low:
1. FIX — encrypt/decrypt still ran per-row sync PBKDF2 (1000 it) → 300-row list blocks event loop ~0.1–0.3s. Added memoized `getAsyncDEK` (CryptrAsync, same key + options = byte-identical format); encrypt/decrypt use it. `getDEK` unchanged (still returns sync Cryptr).
2. FIX — migration prepare→apply lost-update window: writes now `updateMany` guarded on `{ id, content: <original plaintext> }`; test asserts the guard.
3. FIX — criterion 3 KEK-once not test-asserted: added "should build the KEK once, not per request" (spies `Cryptr.CryptrAsync`; mutation-checked: fails if cache bypassed).
4. FIX — P2002 test now throws a real `Prisma.PrismaClientKnownRequestError` (code P2002).
5. FIX (at promote) — proposal §3 still mentions a test-only reset hook; rewrite Approach to reality.
6. IGNORE — empty `## Related` / single-entry `encryption` theme in the new knowledge entry: no sibling entries exist yet; lint advisory only.
Minerva audit (inline): spec fidelity — diff achieves Goal/Approach/criteria; knowledge compliance — corpus has no entries besides this unit's own.
