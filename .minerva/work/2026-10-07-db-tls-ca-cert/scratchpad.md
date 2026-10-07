# Scratchpad: db-tls-ca-cert

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-07
- [user-directed] open-issue match: adopting #48 — user explicitly asked to execute it (coordinator brief); `**Closes**: #48`
- [solo] scope check: one unit, one PR (tier: solo predicate — issue's file-ownership names 1–3 server files, additive, one concern (pg TLS config), no existing interface changed; parallel wave)
- [reviewed — folded] approach: option A (strip SSL params, explicit ssl object); Skeptic: URL/URLSearchParams round-trip can re-encode other params/userinfo → switched to raw query-segment filtering; also added rejected alt D (NODE_EXTRA_CA_CERTS), PEM fail-fast, disable/no-verify override stated (tier: reviewer — introduces new env-var contract DATABASE_CA_CERT, not provably small; parallel wave)
- [rechecked — residual folded] approach: items 4/7 partially (externalPool alt unmentioned; README conditional) — added alt E; new low concern: raw-filter edge cases → added to criterion 2a
- [reviewed — folded] whole-proposal: Skeptic: migrate stays unverified (state residual, assert empirically), rollout ordering + explicit rollback, more SSL-param/URL-mangling tests, whitespace-only var (tier: reviewer — production DB connectivity but gated by unset-by-default var and env-only rollback, so not high blast radius; parallel wave). No restart: approach pick unchanged and approach fold touched only ## Approach
- [rechecked — residual folded] whole-proposal: all items addressed; new low concern (does explicit rejectUnauthorized beat NODE_TLS_REJECT_UNAUTHORIZED=0?) → added CA+flag E2E case to criterion 6

## Work notes
- Empirical (pre-implementation, docker postgres:16 hostssl-only, self-signed CA): `prisma migrate deploy` with `?sslmode=require` and NODE_TLS_REJECT_UNAUTHORIZED unset → applied 25 migrations; `sslmode=disable` → P1010 rejected (TLS was in use); `sslmode=require&sslaccept=strict` → P1011 cert not trusted. Schema engine = native Rust binary, ignores the Node flag.
- Implemented `packages/server/src/util/databaseConfig.mts` (buildPgConfig / stripSslParams / normalizeCaCert) + `database.mts` wiring + 19 tests in `src/util/__tests__/databaseConfig.test.mts` (pg's own ConnectionParameters via createRequire). TS gotcha: an all-optional `{DATABASE_URL?, DATABASE_CA_CERT?}` param type is a "weak type" and rejects `process.env` (TS2559) — typed it `Record<string, string | undefined>`.
- E2E (docker postgres:16, hostssl-only, server cert SAN localhost/127.0.0.1 from self-signed CA, built dist `client.$queryRaw` of pg_stat_ssl), URL always `?sslmode=require`:
  - right CA, flag unset → OK ssl=true; escaped-\n CA → OK; right CA + `sslmode=disable` URL → OK ssl=true (override)
  - wrong CA, flag unset → FAIL "unable to verify the first certificate"; wrong CA + NODE_TLS_REJECT_UNAUTHORIZED=0 → still FAIL (explicit rejectUnauthorized wins)
  - right CA, DNS host not in SAN (`$(hostname)`, `127.0.0.1.nip.io`) → FAIL "Hostname/IP does not match certificate's altnames" (verify-full). IP literal hosts: pg sends no servername, so Node checks a fallback name — passed with 0.0.0.0. DO URLs are DNS names, so SAN coverage matters.
  - no CA var, flag unset → FAIL (legacy behavior); no CA var + flag=0 → OK (current prod unchanged)
  - non-PEM CA → throws at import with clear message
  - `prisma migrate deploy` (worktree prisma.config.ts) on a fresh TLS db, flag unset, sslmode=require → all 25 migrations applied.
- build / test (225 pass) / server lint green.
