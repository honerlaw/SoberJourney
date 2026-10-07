# Proposal: db-tls-ca-cert

**Date**: 2026-10-07
**Status**: Shipped (2026-10-07)
**Closes**: #48

## Goal

Let production verify the managed Postgres TLS certificate against DigitalOcean's cluster CA, so the app-wide `NODE_TLS_REJECT_UNAUTHORIZED=0` can be removed (it currently disables TLS verification for every outbound Node connection: Postgres, Clerk, Gemini, Expo push).

- New optional env var `DATABASE_CA_CERT` (PEM). When set and non-blank, the server's and cron's Postgres pool connect with `ssl: { ca, rejectUnauthorized: true }` (Node default hostname check stays on, i.e. verify-full semantics).
- When absent/blank: byte-for-byte unchanged behavior (`new PrismaPg({ connectionString: \`${process.env.DATABASE_URL}\` })`).
- Code only; DO env changes are done by coordinator/user after deploy.

## Why

Issue #48. DO's managed Postgres presents a cert signed by a per-cluster CA that is not in Node's trust store; `DATABASE_URL` carries `?sslmode=require`. pg therefore fails verification, which prod papered over with `NODE_TLS_REJECT_UNAUTHORIZED=0` app-wide.

## Approach

Shipped as Approach A (below). Base branch `epic/leftovers`. Files: `packages/server/src/util/databaseConfig.mts` (new: `buildPgConfig`, `stripSslParams`, `normalizeCaCert`), `packages/server/src/util/database.mts` (`new PrismaPg(buildPgConfig(process.env))`), `packages/server/src/util/__tests__/databaseConfig.test.mts` (21 tests, incl. a guard that feeds every libpq ssl* key through pg's `ConnectionParameters`). `prisma.config.ts` unchanged. No env docs exist in the repo to update. E2E results: see archive/scratchpad.md.

### Facts checked (repo, package-lock versions)

- Only Postgres connection point in Node: `packages/server/src/util/database.mts` (`new PrismaPg({ connectionString })` → `new pg.Pool(config)` in `@prisma/adapter-pg` 7.2.0). Server (`server.mts`) and cron (`cron.mts`) both get it via `context.mts` importing `client` from `util/database.mjs`. No other `pg.Pool`/`new Client` in `src`.
- `pg` 8.16.3 `ConnectionParameters`: `if (config.connectionString) config = Object.assign({}, config, parse(config.connectionString))` — connection-string params override the config object.
- `pg-connection-string` 2.9.1 `parse`: any of `sslmode`/`sslcert`/`sslkey`/`sslrootcert` sets `config.ssl = {}` (or `false` for `sslmode=disable`; `ssl=true|1|0` too; `uselibpqcompat` changes semantics). So `?sslmode=require` replaces an explicit `ssl: { ca, rejectUnauthorized }` with `{}` — the CA would be silently dropped.
- `prisma migrate deploy` (in `npm run start` / `start:cron`) is run by Prisma 7.2's native Rust `schema-engine` binary (`@prisma/engines/schema-engine-*`) using `datasource.url` from `prisma.config.ts`; it does not use the pg adapter and does not read `NODE_TLS_REJECT_UNAUTHORIZED` (a Node-only knob). **Verified empirically** (docker postgres:16, `hostssl`-only pg_hba, server cert from a self-signed CA, flag unset): `?sslmode=require` → migrations applied; `sslmode=disable` → rejected (proves TLS was used); `sslmode=require&sslaccept=strict` → P1011 "certificate was not trusted". So removing the flag cannot break migrate, and migrate's TLS stays encrypted-but-unverified: **accepted residual**, `DATABASE_CA_CERT` covers runtime pg traffic only. `prisma generate` (build) does not connect to the DB.

### Candidate approaches

**A (recommended). Strip SSL params from the URL, pass an explicit `ssl` object.** New pure module `packages/server/src/util/databaseConfig.mts` exporting `buildPgConfig(env)`; when `DATABASE_CA_CERT` is set it removes `sslmode`, `ssl`, `sslcert`, `sslkey`, `sslrootcert`, `uselibpqcompat` query params by filtering the raw query string on `&`-separated segments by (decoded) key — everything before `?` (scheme, userinfo, host, path) and every kept segment is left byte-identical, no `URL`/`URLSearchParams` re-serialisation — and returns `{ connectionString: stripped, ssl: { ca, rejectUnauthorized: true } }`; otherwise returns `{ connectionString: \`${env.DATABASE_URL}\` }`. Normalises a PEM pasted with literal `\n` escapes and `\r\n`, trims; a multi-cert bundle passes through; a non-blank value with no `-----BEGIN CERTIFICATE-----`, or any block that `crypto.X509Certificate` cannot parse (added after code review: Node's TLS layer silently ignores a corrupt CA), throws a clear error at startup (fail fast, instead of an opaque TLS error at first query). With the CA set, `sslmode=disable`/`no-verify` in the URL are intentionally overridden to verified TLS. `database.mts` uses it. Tests (node:test) assert the output AND feed it through pg's own `ConnectionParameters` to prove the effective `ssl` keeps `ca` + `rejectUnauthorized: true` even when the URL has `sslmode=require`, and prove the unstripped URL would have clobbered it (regression guard on pg semantics).

**B. Parse URL into discrete fields, drop `connectionString`.** Use `pg-connection-string` parse output (host, port, user, password, database, options...) as the Pool config and override `ssl`. Rejected: relies on parse output shape matching PoolConfig (string port, `options`, `application_name`, etc.), larger surface, and needs `pg-connection-string` as a direct dep.

**D. `NODE_EXTRA_CA_CERTS`.** Rejected: needs a file path at process start (DO injects values, not files) and adds process-wide trust.

**E. Build our own `pg.Pool` and pass it as the adapter's external pool.** Same URL-stripping need as A plus more wiring; not better.

**C. Write CA to a temp file and rewrite URL to `sslmode=verify-full&sslrootcert=<file>`.** pg would read it via `fs.readFileSync`. Rejected: filesystem side effect at import, depends on pg-connection-string's evolving sslmode semantics (2.x deprecation warning / libpq-compat), harder to test.

A dominates on: no new deps, no FS, minimal surface, exact unchanged path when unset, testable via pg's own parser.

### Scope

One unit, one PR. Files: new `util/databaseConfig.mts`, `util/database.mts` (2 lines), new test file, (no `.env.example`/README env docs exist). `prisma.config.ts` unchanged (schema engine not affected). No API surface change.

## Success criteria

1. With `DATABASE_CA_CERT` unset or blank, `buildPgConfig` returns exactly `{ connectionString: \`${DATABASE_URL}\` }` (unit test).
2. With it set, the config passed through pg 8.16.3 `ConnectionParameters` yields `ssl.ca === <PEM>` and `ssl.rejectUnauthorized === true` for URLs containing `sslmode=require|disable|verify-full|no-verify`, `ssl=true`, `sslrootcert=...`, `uselibpqcompat=true&sslmode=require`, and none (unit tests).
2a. Stripping preserves everything else: for URLs with a percent-encoded password containing `@ : / % #`, a bracketed IPv6 host, `options=-c%20search_path%3Dfoo`, `schema`, `connection_limit`, `ConnectionParameters` user/password/host/port/database/options are identical before and after stripping, and the non-SSL query segments are byte-identical; edge cases: no query string, every param stripped (no dangling `?`/`&`), valueless `?sslmode`, upper-case key `SSLMODE` (kept — pg's parser is case-sensitive, so it has no SSL effect), malformed `%` escape in a key (no throw), `#fragment` preserved (unit tests).
3. A test proves the unstripped URL + explicit ssl would lose the CA under pg's merge (documents why stripping exists).
4. Escaped `\n` and `\r\n` PEM is normalised; whitespace-only `DATABASE_CA_CERT` counts as unset; a non-PEM value throws a clear error (unit tests).
5. `database.mts` uses `buildPgConfig(process.env)`; server and cron both go through it (grep: no other Pool construction).
6. Local E2E against Postgres-with-TLS (docker, self-signed CA, server cert for `localhost`): right CA + `sslmode=require` URL → query succeeds with `NODE_TLS_REJECT_UNAUTHORIZED` unset; wrong CA → fails with a cert error; env var unset + `sslmode=require` URL → fails as before without the flag and succeeds with `NODE_TLS_REJECT_UNAUTHORIZED=0` (unchanged behavior); right CA + `NODE_TLS_REJECT_UNAUTHORIZED=0` still set → wrong-CA case still fails (explicit `rejectUnauthorized: true` wins over the flag, so rollout step 2 is a real verification gate); `prisma migrate deploy` succeeds against the same TLS server with `sslmode=require` and no `NODE_TLS_REJECT_UNAUTHORIZED`. Results recorded in the scratchpad / PR body.
7. `npm run build`, `npm run test`, server lint green.
8. Final report carries exact DO rollout + rollback steps for both `soberjourney` service and `soberjourney-cron` job, ordered: deploy code → add `DATABASE_CA_CERT` (flag still set) and confirm healthy → remove `NODE_TLS_REJECT_UNAUTHORIZED` and confirm (deploy ACTIVE, `/api/app/config` 200, cron run OK). Rollback per step: remove `DATABASE_CA_CERT` and/or re-add the flag. States that migrate TLS remains unverified (residual).

## Open Questions

- Does DO's server cert cover the hostname in `DATABASE_URL` (public vs private `private-` host)? Node's default `checkServerIdentity` will enforce it. The private and public hosts may carry different SANs; rollout should first set the var on the cron job (or force a cron run) to test the exact host, since a hostname mismatch fails at first query with `Hostname/IP does not match certificate's altnames`, rollback = remove `DATABASE_CA_CERT`. Not resolvable from code.
