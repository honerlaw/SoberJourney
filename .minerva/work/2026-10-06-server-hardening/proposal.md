# Proposal: server-hardening

**Date**: 2026-10-06
**Status**: Draft
**Closes**: #27

## Goal

Close every task in GitHub issue #27 inside its file-ownership list while keeping every released App Store build working (epic #34 API compatibility rules):

- no secret values in logs;
- account deletion also deletes the Clerk user;
- an additive `user.revokePushToken` procedure;
- a host-allowlisted redirect (`https://www.<matchedHost>`, 308);
- Clerk `debug` off and an `info` logger in production;
- tolerant input validation that coerces, clamps or ignores, and never newly rejects what a released app sends;
- one user upsert per tRPC request, and none on static assets;
- journey create as a single statement;
- a check-in get-or-create that recovers from the create race;
- 404 JSON for unknown `/api/*` paths;
- the foreign-key and status indexes in one migration;
- a Dockerfile that builds.

Base branch: `epic/audit-wave-1`, the epic base the user chose.

## Why

The #27 audit found these problems:

- Config error logs leak secrets.
- The app promises to "permanently delete" the account, but the Clerk identity is left behind.
- The `x-iana-time-zone` header is written to `User.timezone` without validation. One bad value can break the notification cron for that user, and a missing header resets the stored timezone to the default.
- Fractional urge values cause 500s, because the DB column is an `Int`.
- Inputs have no length bounds.
- Journey create makes several writes without a transaction.
- Check-in get-or-create has a find-then-create race on the unique `journeyId`.
- Every tRPC request upserts the user twice, and so does every static asset request.
- Hot lookups have no foreign-key indexes.
- The Dockerfile copies `node_modules/.prisma`, which the custom `prisma-client` output never creates.

## Approach

Approach A applies the hardening in place, file by file, and favours tolerant fixes over rejection.

Facts checked in the repo:

- Released apps call `https://www.soberjourney.app`. That is `extra.apiUrl` in `packages/app/app.config.ts`, and `ConfigProvider.tsx` uses the same fallback.
- The redirect only fires on 2-label apex hosts, so app API traffic is never redirected.
- The app calls only `/api/app/config` and `/api/trpc/*`. The `/api/health` endpoint is for probes.
- No journey, journal or check-in input in the app sets a `maxLength`.
- `express.json()` already caps request bodies at 100kb.
- `DeleteAccountButton` calls `user.remove` and then `logout()`. `logout()` swallows sign-out errors.

### 1. Config log (`util/config.mts`)

Log only the key, plus each zod issue's path, code and message. Never log `process.env[key]` or the default value.

### 2. Account deletion (`route/user/remove.mts`)

1. Delete the DB user first. The response is unchanged: `{ success, user: { id, createdAt } }`.
2. Then call `ctx.datasource.clerk.client.users.deleteUser(authId)` inside try/catch.
   - A Clerk 404 (the user is already gone) counts as success and is logged at info.
   - Any other Clerk failure is logged at `error` with the authId and tags. It never fails the mutation.

Known, accepted limits, which are stated in the PR body:

- **(a) Best-effort Clerk deletion.** "Permanently delete" removes the data, but the Clerk identity survives if Clerk errors. A later sign-in would then create a fresh, empty account.
- **(b) Stray requests can re-create an empty user row.** Clerk session tokens are verified locally and live for about 60 seconds. A request already in flight, or fired before the app's immediate `logout()`, can re-create an empty `User` row (authId and timezone only) through the context upsert. This already happens today. Clerk deletion bounds the window to one token lifetime, because a revoked session cannot mint new tokens. The window does not close instantly. Skipping the upsert for `user.remove` would not help, because the stray request is a different procedure.

### 3. New `user.revokePushToken` procedure (additive)

- **Input:** `{ token: string(1..4096) }`.
- **Behaviour:** an authenticated mutation. It sets `revoked=true` on the caller's matching `UserPushToken` rows through `database/user/revokePushToken.mts` (`updateMany where {userId, token}`).
- **Returns:** `{ success: true, revoked: <count> }`.
- **Idempotent:** an unknown token returns success with a count of 0.
- **Location:** `database/notification/**` belongs to #26, so the helper lives under `database/user/`.

Re-registration safety:

- `user.addPushToken` re-activates the caller's own row when the upserted token comes back with `revoked=true`. It does this through `database/user/reactivatePushToken.mts` (`updateMany where {userId, token, revoked: true}`).
- This covers the case of signing out and back in on the same device. The response of `addPushToken` is unchanged.
- An explicit re-registration by the signed-in user is the strongest signal that the token is live for them. So re-activation also applies to a row that #26's delivery path revoked.
- **Accepted cost:** at most one extra failed send, after which #26's path revokes the row again.
- A token re-registered by a *different* user (device handoff) is #26's case and is not handled here.

Deliverable before merge: a comment on #26 describing the new procedure, the re-activation rule, and the schedule-mirroring note in item 11. If #26 also makes `upsert` un-revoke, the two are idempotent and this re-activation stays.

### 4. Redirect (`util/middleware/redirect.mts`, `server.mts`, `util/config.mts`)

- Set `app.set("trust proxy", 1)`, which assumes one proxy hop. It now only affects `req.ip` and `req.protocol` in logs, because the redirect no longer reads `req.protocol`.
- Redirect only when the host, port stripped and lower-cased, is in the allowlist. The allowlist is a new optional `REDIRECT_APEX_HOSTS` entry in the validated env schema: comma-separated, default `soberjourney.app`. It is the setting to change if production serves other apex hosts.
- The redirect goes to `https://www.${matchedHost}${originalUrl}` with a 308, which preserves the method and body.
- Unknown hosts pass through untouched, so there are no redirects built from a poisoned `Host` header.
- The canonical destination for the real apex is unchanged. `www.`, localhost and ngrok hosts are unaffected, as today.

### 5. Clerk debug and logger level

- `clerkMiddleware({ debug: NODE_ENV !== "production" })`.
- The logger level comes from a pure `resolveLogLevel(env)`:
  - `LOG_LEVEL` wins when it is a valid pino level. An operator may deliberately choose `debug` or `trace`.
  - Otherwise the level is `info` in production and `debug` elsewhere.
- The logger reads `process.env` directly, because `config` imports the logger.

### 6. Timezone (`context.mts`, `database/user/upsert.mts`, `database/user/isValidTimeZone.mts`)

`isValidTimeZone(tz)` accepts a value only when all of these hold:

- it is a string of at most 100 characters;
- it is shaped like an IANA name, either `UTC` or `Area/Location[/Sub]` made of letters, digits, `_`, `+` and `-`. This excludes raw offset strings like `+05:00`, which newer V8 accepts. It also ignores legacy names such as `EST5EDT` and bare `GMT`;
- `new Intl.DateTimeFormat("en-US", { timeZone })` does not throw.

An invalid or missing header becomes `undefined`. Upsert then behaves as follows:

| Header | Create | Update |
|---|---|---|
| Valid | Written | Written, so travellers and DST changes still sync |
| Absent or invalid | Default `America/New_York` | Stored value left untouched |

The token-string context path now passes `undefined`, so it no longer overwrites the stored timezone with the default. A request is never rejected over its timezone.

### 7. `urgeStrength` (`route/checkin/create.mts`)

Use `z.number().min(1).max(10).transform(Math.round)`. The range check runs before rounding. The response echoes the rounded, stored value. The schema comment is corrected to 1-10.

### 8. Maximum lengths

The bounds are generous, consistent with the 100kb body cap:

| Field | Maximum |
|---|---|
| Journal `content` and check-in `journalEntry` | 100,000 characters |
| Journey `title` | 1,000 characters |
| Push `token` (`addPushToken` and `revokePushToken`) | 4,096 characters |
| `reorder.items` | 1,000 items |

Titles use one shared schema for `journey.create` and `journey.update`: `z.string().min(1).max(1000).transform(s => s.trim() || s)`.

- The bounds are checked first, and trimming can only shorten the title.
- A whitespace-only title is kept as it is. Nothing new is rejected; the client-side fix is #30's.

### 9. Future `startDateTime` (`route/journey/create.mts`)

Clamp it with `.transform(d => d > now ? now : d)`. `journey.update` has no date field. The PR contract line notes the two value-meaning changes the issue prescribes:

- the returned `title` is the trimmed title;
- a future start date is stored, and returned in `entries`, as server-now.

### 10. Context scoping (`server.mts`, `context.mts`, `network/rpc/index.mts`)

- Drop the global `contextMiddleware`. It ran on every static asset and duplicated tRPC's own `createContext`.
- tRPC's `createContext` becomes the single context per HTTP request, and that includes batched calls.
- `/api/health`, `/api/app/config`, static files and SPA routes no longer trigger an upsert.
- Remove the now-unused middleware and the `serverContext` global type.
- `clerkMiddleware` stays global, for the web SPA handshake.

### 11. Single-statement journey create (`database/journey/create.mts`, route)

One nested Prisma create writes the journey and its first entry. When notification settings are given, it also writes `checkIn: { create: { userId, pushNotificationSchedule: { create: { userId, frequency, minuteOfDay } } } }`.

- It is a single statement, so it is atomic.
- It claims atomicity only. A client retry after a successful create still makes a second journey.
- It duplicates #26's schedule-creation fields for a brand-new check-in. A code comment and the comment on #26 record that changes to schedule creation must be mirrored here.
- The response shape, including the `journey.entries` include, is unchanged.

### 12. Check-in get-or-create (`database/checkin/getOrCreate.mts`)

- Use `upsert({ where: { journeyId }, create: { journeyId, userId }, update: {} })`.
- Return null if the row's `userId` differs from the caller.
- On a P2002 (concurrent create), re-read the row.
- This recovers from the race; it does not claim to prevent it.

### 13. 404 for unknown `/api/*` (`server.mts`, `network/http/notFound.mts`)

- Register an exported `apiNotFound` handler on `app.all("/api/{*splat}")`, returning `404 { error: "Not found" }`.
- It is registered after `/api/health`, `/api/trpc` and `/api/app/config`, and before the static files and SPA fallback.
- tRPC's own unknown-procedure 404 is unaffected.
- Bare `/api` does not match and falls through to the SPA fallback, as today.

### 14. Indexes (`prisma/schema/**`)

Add an `@@index` on each of:

- `Conversation.userId`
- `ConversationMessage(conversationId, createdAt)`
- `JournalEntry.userId`
- `UserJourney.userId`
- `UserJourneyEntry.journeyId`
- `JourneyCheckInEntry.checkInId`
- `UserPushNotificationSchedule.userId`
- `UserPushNotification.status`

The single migration `prisma/migrations/20261006120000_add_fk_and_status_indexes/migration.sql` is generated by `prisma migrate diff --from-schema <pre-change schema dir> --to-schema prisma/schema --script`.

It is verified by running `prisma migrate deploy` against a scratch Postgres 15, followed by `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script`, which must print an empty migration. This is the "single clean migration" acceptance check, and the evidence goes in the PR body.

A plain `CREATE INDEX` briefly blocks writes on each table. That is acceptable at current data sizes and is noted in the PR.

### 15. Dockerfile

- Remove the `COPY node_modules/.prisma` line. The `prisma-client` generator writes to `src/generated`, and `npm run build` copies that into `dist/generated` after running `codegen` first.
- Drop the duplicate codegen step.
- Use `COPY package*.json ./` plus `RUN if [ -f package-lock.json ]; then npm ci; else echo "WARNING: ..." && npm install; fi`.

This is a **partial close, stated in the PR body.** The workspace lockfile lives at the repo root, outside the `packages/server` build context, so today's deploy runs the fallback. Making `npm ci` effective needs a change to the deploy's build context, which cannot be discovered from the repo. That is recorded as a follow-up.

### Tests (node:test)

- `isValidTimeZone`.
- User upsert:
  - a valid timezone is stored on update;
  - an invalid or missing timezone on update leaves the stored value untouched;
  - create uses the default.
- `resolveLogLevel`.
- Redirect middleware:
  - allowlist with the port stripped;
  - 308 to `https://www.<matchedHost>`;
  - pass-through for `www.`, localhost and unknown hosts.
- The config error log contains no env value.
- Check-in and journey input schemas:
  - rounding;
  - range rejection kept;
  - title trim and whitespace-only kept;
  - maximum bounds;
  - future-date clamp.
- `user.remove`:
  - a Clerk failure keeps the response shape;
  - a Clerk 404 is treated as success.
- `revokePushToken`, and `addPushToken` re-activation, including a delivery-revoked row.
- `getOrCreate`: the upsert path, the other-user null, and the P2002 fallback.
- Journey create (mocked client):
  - one `create` call;
  - the schedule is nested only when settings are given;
  - `entries` are included.
- `apiNotFound`.

### Alternatives considered

- **B: strict validation** (`.int()`, `.trim().min(1)`, reject future dates, tight 200/10,000 bounds). Rejected because it violates epic rule 2.
- **C: Clerk delete first, then the DB.** Rejected. If the DB delete then fails, the data is stranded with no login to retry. The brief also requires the DB delete to succeed even if Clerk fails.
- **D: remove the redirect, or move it to the edge.** Rejected because it changes canonical behaviour and we have no access to the deploy config.
- **E: `$transaction(async tx => …)` reusing the existing DB helpers.** Rejected. The helpers are typed against the full client and wrapped, so this needs a refactor that reaches into #26's `database/notification/**`.
- **F: an interactive `$transaction` calling Prisma directly on `tx` in `database/journey`, with no helper reuse.** Viable, but dominated. It needs more code and `tx` plumbing for the same atomicity, and it duplicates the schedule fields just as the nested create does.

## Success criteria

1. `npm run build`, `npm run test` and `npm run lint --workspace=@onerlaw/soberjourney-server` pass in the worktree.
2. The config error path logs no env value. A test asserts that the logged object does not contain the secret.
3. `user.remove` deletes the DB user, attempts the Clerk deletion, treats a Clerk 404 as success, and returns the same shape when Clerk throws (test).
4. `user.revokePushToken` exists, is a mutation, and revokes only the caller's matching tokens (test). After a revoke, by sign-out or by a delivery error, `user.addPushToken` with the same token re-activates the caller's own row (test). The comment on #26 is posted before merge.
5. Redirect (test):
   - An allowlisted apex host goes to `https://www.<matchedHost><originalUrl>` with a 308. The default list is `soberjourney.app`; `REDIRECT_APEX_HOSTS` overrides it.
   - `www.` hosts, localhost and any non-allowlisted host call `next()`.
   - `trust proxy` is set.
6. In production, Clerk `debug` is false. The default logger level is `info`, with no `debug` or `trace` unless `LOG_LEVEL` sets it explicitly. `resolveLogLevel` is tested, and the `debug` flag is checked by inspection.
7. A valid `x-iana-time-zone` is stored on both create and update. An invalid or missing one never changes an existing user's stored timezone and never fails the request (test).
8. `urgeStrength` 3.5 is stored as 4. Integers 1 to 10 are unchanged, and out-of-range values are still rejected as before (test).
9. The maximum bounds are in place at the stated generous values. Whitespace-only titles are still accepted, and other titles are trimmed (test).
10. A future `startDateTime` is clamped to now (test).
11. There is one user upsert per tRPC request and none for static, SPA, `/api/health` or `/api/app/config` requests. Checked by inspection:
    - `server.mts` mounts no context middleware;
    - `grep createContext` shows the tRPC adapter as the only request-path caller.
12. Journey create with notification settings is a single nested Prisma create. A mocked-client test asserts one `userJourney.create` call, the nested check-in and schedule only when settings are given, and `entries` included.
13. `getOrCreate` uses `upsert`, returns null for another user's row, and recovers from a P2002 by re-reading (mocked-client test).
14. `apiNotFound` returns 404 JSON (unit test). Route order is checked by inspection of `server.mts`:
    - health, trpc and config come before the `/api/{*splat}` 404;
    - static files and the SPA fallback come after it.
15. There is a single clean migration containing only the 8 `CREATE INDEX` statements:
    - `prisma validate` passes;
    - `prisma migrate deploy` on a scratch Postgres applies every migration;
    - `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` is then empty.
16. The Dockerfile no longer copies `node_modules/.prisma`. It uses `npm ci` when a lockfile is present, with a logged `npm install` fallback. The PR body states that this is a partial close of the `npm ci` task.
17. API contract: additive only.
    - `user.revokePushToken` is added.
    - Inputs are only loosened or coerced, and gain generous maximum bounds: `journey.create`/`update` title, `journey.create` startDateTime, `checkin.create` urgeStrength and journalEntry, `journal.create` content, `user.addPushToken` token, `journey.reorder` items.
    - Output shapes are unchanged, except for the value changes the issue prescribes: the trimmed `title`, a future date stored as now, and the rounded `urgeStrength` echo.
    - `user.addPushToken` can now un-revoke the caller's own token.

## Open Questions

- The deploy's Docker build context (repo root or `packages/server`) cannot be discovered from the repo. Full `npm ci` reproducibility depends on it, so this is deferred as a follow-up.
- Production must leave `REDIRECT_APEX_HOSTS` unset, or set it to include its real apex. This goes in the PR notes.
