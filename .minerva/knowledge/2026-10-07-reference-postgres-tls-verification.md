# Postgres TLS verification is opt-in via DATABASE_CA_CERT; migrations stay unverified

**Date**: 2026-10-07
**Type**: reference
**Theme**: server-operations
**Summary**: DATABASE_CA_CERT enables verify-full for runtime pg; prisma migrate deploy ignores it and the Node TLS flag
**Context**: .minerva/work/2026-10-07-db-tls-ca-cert (see git history if the worktree has been cleaned up)

## Context
Production on DO App Platform had `NODE_TLS_REJECT_UNAUTHORIZED=0` app-wide only so that `pg`
would accept the managed cluster's certificate. That flag disabled TLS verification for
Clerk, Gemini and Expo push too (#48).

## Finding
- `DATABASE_CA_CERT` (PEM; on DO, `${<db-component>.CA_CERT}`) is optional. When it is unset or
  blank, `util/database.mts` builds exactly `{ connectionString: \`${DATABASE_URL}\` }` as
  before. When it is set, the pool connects with `ssl: { ca, rejectUnauthorized: true }`.
  Node's default `checkServerIdentity` makes this verify-full.
- The explicit `rejectUnauthorized: true` wins over `NODE_TLS_REJECT_UNAUTHORIZED=0`. A
  wrong CA fails even while the flag is still set, which was verified against docker
  Postgres.
- Hostname checking keys off pg's `servername`, which pg sets only for DNS hosts. With an
  IP-literal host, Node checks a fallback name. The `DATABASE_URL` host must appear in the
  server cert's SANs, otherwise every query fails with "Hostname/IP does not match
  certificate's altnames".
- A value without a parseable `-----BEGIN CERTIFICATE-----` block throws at import, so the
  server and cron fail at boot with a clear message. Literal `\n` escapes and CRLF are
  normalised.
- `prisma migrate deploy` (in `npm run start` / `start:cron`) runs Prisma 7.2's native
  Rust schema engine against `prisma.config.ts`'s `datasource.url`. It never sees
  `DATABASE_CA_CERT` and does not read `NODE_TLS_REJECT_UNAUTHORIZED`. With
  `sslmode=require` it encrypts but accepts any certificate. It fails with P1011 only when
  `sslaccept=strict` is set. Removing the Node flag therefore cannot break migrations, and
  migration TLS remains unverified. That is an accepted residual.
- `/api/health` and `/api/app/config` do not touch the database. A DB-TLS misconfiguration
  shows up only on real queries and in the cron run.

## Implications
- Rollout order: deploy the code, then add `DATABASE_CA_CERT` while the flag is still set
  (cron job first, then the service), confirm queries and a cron run succeed, and only
  then remove `NODE_TLS_REJECT_UNAUTHORIZED`. To roll back, re-add the flag or delete
  `DATABASE_CA_CERT`.

## Related
- [[2026-10-07-constraint-pg-connection-string-ssl-overrides-config]] — why ssl* params are stripped from DATABASE_URL
