# A `sslmode` in DATABASE_URL silently replaces an explicit pg `ssl` config

**Date**: 2026-10-07
**Type**: constraint
**Theme**: server-operations
**Summary**: pg merges parsed connection-string params over config; strip ssl* params before passing `ssl`
**Context**: .minerva/work/2026-10-07-db-tls-ca-cert (see git history if the worktree has been cleaned up)

## Context
The server builds its Postgres pool via `new PrismaPg(config)`, which hands `config` to
`new pg.Pool(config)`. To verify TLS against DigitalOcean's cluster CA we pass
`ssl: { ca, rejectUnauthorized: true }`, but DO's `DATABASE_URL` ends in `?sslmode=require`.

## Finding
In pg 8.16.3, `ConnectionParameters` does
`config = Object.assign({}, config, parse(config.connectionString))`, so connection-string
params win. pg-connection-string 2.9.1 sets `ssl = {}` whenever `sslmode`, `sslcert`,
`sslkey` or `sslrootcert` is present (`false` for `sslmode=disable`; `ssl=true|1|0` also maps),
so the explicit `ssl` object, and its CA, is dropped without any error. The connection then
uses Node's default trust store and fails with "unable to verify the first certificate".

`packages/server/src/util/databaseConfig.mts` therefore removes `ssl`, `sslmode`, `sslcert`,
`sslkey`, `sslrootcert` and `uselibpqcompat` from the raw query string when
`DATABASE_CA_CERT` is set. It filters `&` segments by decoded, case-sensitive key, the way
pg-connection-string reads them via `URLSearchParams`, and keeps everything else
byte-identical. It does not round-trip through `URL`/`URLSearchParams`, which would
re-encode other params such as `options=-c%20...`.

## Implications
- Any new code that passes both a `connectionString` and an explicit option to pg must
  assume the URL wins for every key pg-connection-string understands.
- `SSL_PARAMS` must be re-checked whenever pg / pg-connection-string is upgraded. The
  test `databaseConfig.test.mts` feeds every libpq `ssl*` key through pg's own
  `ConnectionParameters` as a guard.
- `PGSSLMODE` only applies when `config.ssl` is undefined, so it cannot override the explicit
  object.

## Related
- [[2026-10-07-reference-postgres-tls-verification]] — how the CA config is enabled and rolled out
