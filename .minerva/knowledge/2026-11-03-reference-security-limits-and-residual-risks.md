# Abuse limits, their env knobs, and the security risks still open

**Date**: 2026-11-03
**Type**: reference
**Theme**: server
**Summary**: Per-user limits (batch 25, mutations 60/min 1000/h, decrypts 30k/min, 5k journal entries, 200 journeys) with env overrides; JSON-only POSTs; opt-in authorizedParties; residual risks and how to enable the remaining controls
**Context**: .minerva/work/2026-11-03-security-audit-hardening (see git history if the worktree has been cleaned up)

## Context
The 2026-11-03 security audit found no cross-user data access, but found a Sentry privacy leak, unbounded cost per request, missing write limits, a CSRF path, missing security headers, and a few fail-open defaults. This entry is the operating reference for the controls that shipped and for what is still open.

## Finding
**Limits.** Every numeric limit reads an optional env var at use time, straight from `process.env` (`util/limits.mts`). An invalid value falls back to the default, and `0` disables that control. A bad value can never fail `getConfig`.

| Control | Default | Env | Rejection |
|---|---|---|---|
| Procedures per `/api/trpc` request (decoded path, `%2C` counts) | 25 | `TRPC_MAX_BATCH_SIZE` | HTTP 400 `BAD_REQUEST` |
| Mutations per user | 60/min, 1000/h | `MUTATION_LIMIT_PER_MINUTE`, `MUTATION_LIMIT_PER_HOUR` | `TOO_MANY_REQUESTS` |
| Decrypted values per user | 30,000/min | `DECRYPT_LIMIT_PER_MINUTE` | `TOO_MANY_REQUESTS` |
| Journal entries per user (check-in journals included) | 5,000 | `JOURNAL_ENTRY_QUOTA` | `FORBIDDEN` |
| Journeys per user | 200 | `JOURNEY_QUOTA` | `FORBIDDEN` |
| POST must be `application/json` | on | `TRPC_JSON_ONLY_POSTS=0` turns it off | HTTP 415 `UNSUPPORTED_MEDIA_TYPE` |

- **Released apps.** No rejection is ever `UNAUTHORIZED`/401 or contains "Token expired"/"Invalid token", so none logs a user out. Queries retry on 429 (up to 3 times) but not on 400/403/415; mutations never retry. The decrypt budget is reserved before any decryption, so a retried 429 costs nothing.
- **Mutation limit.** It is a middleware on the shared `procedure` in `network/rpc/router.mts`, so every route gets it. Chat still has its own stricter `chatRateLimit`.
- **Lists.** `decryptMany` reserves the whole count first. `journal.list` and conversation history use it.
- **Check-in at the journal quota.** A check-in that carries journal text is refused whole (FORBIDDEN, mood not saved) so it is never half-saved. One without journal text still saves.
- **Oversized single request.** A cost above a window's max (e.g. listing more entries than the decrypt budget) is charged at the max, so it succeeds once the window is empty instead of never.
- **In-process only.** Every limiter (mutation, decrypt, chat, the conversation lock) counts per server instance and resets on deploy. The limits assume DigitalOcean runs one instance. A multi-account attacker still gets N× the per-user budget.

**Other controls.**
- `errorFormatter` (`network/rpc/errorFormatter.mts`): an INTERNAL_SERVER_ERROR that tRPC built by wrapping a non-tRPC throw gets a generic message. Deliberate messages and every other code pass through unchanged. The real cause is logged server-side by the adapter's `onError` (`network/rpc/logRpcError.mts`), so look in the server logs, not client Sentry, for these.
- A terminal Express `errorHandler` sends only the status text (body-parser's 400/413/415 are kept). Without it Express's default page rendered stack traces whenever NODE_ENV was unset.
- tRPC `isDev` and Clerk `debug` are on only when `NODE_ENV=development`.
- Security headers: `frame-ancestors 'none'`, `X-Frame-Options: DENY`, nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, and HSTS on HTTPS. `X-Powered-By` is off.
- `CLERK_AUTHORIZED_PARTIES` (comma-separated origins) is opt-in.
- `EXPO_ACCESS_TOKEN` is optional and authenticates push sends.
- The app logs tRPC only in `__DEV__`. Sentry drops console breadcrumbs, strips query strings from request breadcrumbs, and samples traces at 10% in production. Notification taps follow only `/(auth)/` paths.

**Still open (residual risks).**
- **Sentry, finding 1.** The fix reaches only binaries that receive the EAS Update. Builds from before expo-updates keep logging until users upgrade. Events already in Sentry stay there until someone purges or scrubs them in the Sentry project.
- **Same-site token reuse, finding 4.** Cross-site CSRF is closed by JSON-only POSTs plus CORS without credentials. A sibling subdomain could still reuse a session token until `CLERK_AUTHORIZED_PARTIES` is set. To enable it:
  1. Decode a native token and a web token and confirm what `azp` each carries. Clerk skips the check when `azp` is absent.
  2. Set the variable to the web origin(s).
  3. Watch for 401s right after deploy. A wrong value logs every user out.
- **Script/style CSP, finding 5.** Not set. Only `frame-ancestors` ships. A full CSP needs live checks against the Expo web build, Clerk, Turnstile and Sentry.
- **Push-token takeover, finding 6.** Any signed-in user can register a push token string they know. This cannot be closed server-side. To limit it:
  1. Set `EXPO_ACCESS_TOKEN`.
  2. Enable "enhanced push security" in the Expo dashboard.
- **NODE_ENV, finding 9.** Unconfirmed on DigitalOcean. The code is safe either way.
- **Clerk bump untested end to end.** @clerk/express 1.7.60 → 1.7.84 (@clerk/backend 2.29 → 2.33.8) has no server test exercising real token verification. After deploy, watch the 401 rate, since a verification change would log released apps out.

## Implications
- Tune a limit through its env var before changing code. The knobs exist so a miscalibration is fixed without a deploy of logic.
- To back out a control with no knob (headers, errorFormatter, ownership checks, lock key), revert only its commit. A revert that touches app commits publishes an over-the-air update of the old app and brings the Sentry leak back.
- A new route gets the mutation limit automatically. A new decrypt call site should use `decryptMany` for lists, so its cost is reserved before any work.
- The privacy-helper check (`packages/app/scripts/check-privacy-helpers.mjs`) runs in CI as a direct `node` call. Adding it as an app `package.json` script changed the native fingerprint (72f9f8ad… vs 239adbf6…), which would have blocked over-the-air updates. Treat any app `package.json` scripts edit as a native change.
- Moving to more than one server instance makes every in-process limit per-instance. Move them to a shared store first.

## Related
- [[2026-10-06-reference-released-app-compatibility]] — the released-client behaviour these rejection codes were chosen against
- [[2026-10-10-decision-sponsor-chat-scope-guard-and-rate-limit]] — the chat limiter this generalises
- [[2026-10-10-decision-eas-update-publish-on-merge-by-fingerprint]] — why the app fixes ship over the air and how to roll them back
- [[2026-10-06-decision-request-scoped-dek-memo]] — the per-request key memo `decryptMany` builds on
