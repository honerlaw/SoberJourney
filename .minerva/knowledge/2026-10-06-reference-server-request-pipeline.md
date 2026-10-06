# Server request pipeline: redirect, Clerk, one tRPC context, API 404

**Date**: 2026-10-06
**Type**: reference
**Theme**: server-operations
**Summary**: Request flow, per-request context creation, timezone sync and redirect/proxy settings in server.mts
**Context**: .minerva/work/2026-10-06-server-hardening (see git history if the worktree has been cleaned up)

## Context
Before #27, a global `contextMiddleware` upserted the user on every request, including static assets. The tRPC adapter then did it a second time. The redirect also trusted any 2-label `Host` header.

## Finding
`packages/server/src/server.mts` runs requests through these steps, in order:
1. `app.set("trust proxy", 1)`, which assumes one TLS-terminating hop. It only affects `req.ip` and `req.protocol` in logs.
2. `redirectToWwwMiddleware(parseApexHosts(REDIRECT_APEX_HOSTS))`. It only sends allowlisted apex hosts (env `REDIRECT_APEX_HOSTS`, default `soberjourney.app`) to `https://www.<host><url>`, using a 308. Any other host passes through. Released apps call `https://www.soberjourney.app` directly, so they are never redirected.
3. `clerkMiddleware` runs globally, with `debug` only when `process.env.NODE_ENV !== "production"`. The logger level comes from `LOG_LEVEL`, or else `info` in production and `debug` elsewhere.
4. `/api/health`, then `/api/trpc`, where tRPC's `createContext` is the **only** request-path context and user upsert, then `/api/app/config`.
5. `app.all("/api/{*splat}")` returns a 404 JSON body. Bare `/api` does not match.
6. Static files, then the SPA `index.html` fallback.

The user upsert writes `timezone` only when `x-iana-time-zone` passes `isValidTimeZone`. A valid name is an IANA name with one or more segments, and not offset-like. Otherwise a new user gets `America/New_York` and an existing user keeps the stored value.

Known deploy follow-ups, which are not defects today:
- The Dockerfile only uses `npm ci` when a lockfile is inside the build context. The workspace lockfile lives at the repo root, so with `packages/server` as the context the build falls back to `npm install`.
- The `build` script's `cp -r ./src/generated ./dist/generated` nests the copy as `dist/generated/generated`. This is harmless, because tsc output is what runs.

## Implications
- Do not reintroduce a global context middleware. Add per-request work inside tRPC `createContext`, or as route-scoped middleware.
- If production serves another apex domain, add it to `REDIRECT_APEX_HOSTS`. If more proxy hops are added, revisit `trust proxy`.
- Making Docker installs reproducible requires building from the repo root, which changes the deploy contract.

## Related
- [[2026-10-06-pattern-prisma-migration-without-live-db]] — schema and migration workflow for the same server
