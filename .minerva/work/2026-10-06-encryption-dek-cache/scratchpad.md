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
