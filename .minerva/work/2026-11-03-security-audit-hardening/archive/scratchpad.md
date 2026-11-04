# Scratchpad: security-audit-hardening

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-11-03
- [reviewed — folded] scope check: one unit, one PR; folded fingerprint fallback (drop dep bump if fingerprint changes) + diff-size estimate (tier: reviewer — not provably small, spans app/server/deps; parallel wave)
- [rechecked — escalated] scope check: items 2 (revert coupling) and 4 (calibration against released builds, 415 gate) partially addressed → panel
- [panel — 3/3 accept, 3 with fixes] scope check: one unit, one PR, no phases (tier: panel — fold-audit escalation; quorum 3/3)
    - fix (all): rollback story — one commit per control, app commits separate; revert only the server commit; whole-PR revert re-ships the old app; eas update:republish / roll-back-to-embedded; split out a stalled control
    - fix (skeptic/arbiter): numeric limits env-overridable, 0 disables
    - fix (all): git-history released-client calibration evidence written into the proposal (mutation cap, batch cap, 415 gate), retry/rapid-tap and multi-device reasoning
    - fix (all): rejection codes never UNAUTHORIZED/401, no "Token expired"/"Invalid token" messages; criterion for errorFormatter pass-through
    - fix (all): dropped dep bump → GitHub issue + tell user finding 8 stays open; re-run predict after final rebase; verify eas.yml published after merge
    - fix (skeptic/arbiter): review focus adds @clerk/express, mutation limiter, user upsert; confirm dead token branch / EXPO_ACCESS_TOKEN unreachable from clients
    - fix (proponent/arbiter, optional): real tRPC client test against the guard — adopted (criterion 6)
- [panel — 3/3 accept, 3 with fixes] approach: A (tier: panel — existing interface change: new rejections on procedures released apps call; knowledge tension with tolerant-validation pattern; parallel wave)
    - fix: residual wording for findings 4/5/6/9; decrypt budget calibrated on one encrypted field per entry and reserved up front; mutation-limit headroom; batch cap covers GET and POST; single-instance limitation; guard ordering; UNAUTHORIZED pinned through errorFormatter
- [restart] whole-proposal: first-wave review stale — scope fold and approach fixes rewrote Goal and Success criteria; re-selected tier reviewer, re-dispatched against the merged draft
- [reviewed — folded] whole-proposal: folded (1) finding-1 OTA-only reach + existing Sentry data as residual, sendDefaultPii/replay checked; (2) batch cap counts the decoded path (%2C), guard-after-Clerk wording, encoded-comma test; (3) mechanical grep check for criterion 20; (4) real httpBatchLink/httpBatchStreamLink test, no-content-type POST unchanged. Dismissed: (5) stated frame-header scope; (6) adopted via scope fix; (7)(8) stated residual visibility and per-code retry/logout behaviour (tier: reviewer — not provably small; parallel wave)
- [rechecked — clean] whole-proposal: fold-audit confirmed items 1–8 addressed; new low/medium wording points applied in self-review (grep scope excludes tests/comments; TRPC_JSON_ONLY_POSTS kill switch for the 415 gate; dropped bump removes package.json/lockfile changes)
- [reviewed — clean] completion verification: Verifier reproduced all 21 criteria (audit clause of 18 taken from recorded run; rebase re-check is a ship-time step) (tier: reviewer floor — no interface change beyond what the proposal approved)
- [solo] review triage: 5 FIX / 2 SUGGEST / 0 IGNORE-without-note (tier: default-solo row — no finding had two defensible dispositions)

## Work notes 2026-11-03
- Local toolchain: `npm ci` in the worktree needs NPM_TOKEN from ~/.npmrc and `packages/server/.env` with a placeholder DATABASE_URL (gitignored). App `tsc` needs the server built first (it imports the server's AppRouter types) — the ConversationProvider errors before `npm run build` in server were only that.
- Fingerprint gotcha: the main checkout's node_modules are stale (pre-SDK-57), so a fingerprint computed there differs (6120edc…). The true comparison was main's app files checked out over this worktree's fresh install: main = branch = 239adbf6321f8911c7c50247d7d75c6bc388afe4, before and after the dependency bump. `packages/app/scripts/eas-deploy.sh predict` (eas-cli 27.2.0, logged in): production fingerprint 239adbf6…, finished production build 6c7b726a-421c-4682-8307-344a7a318c70, "Decision: update". Re-run after the final rebase.
- tRPC parsing facts relied on: the express adapter takes `req.path` after the last "/", `resolveResponse` runs `decodeURIComponent` then `split(",")` (only with `?batch=1`; the guard counts regardless — no procedure name contains a comma). jsonContentTypeHandler matches `startsWith("application/json")`; a POST without content-type → UNSUPPORTED_MEDIA_TYPE "Missing content-type header" (unchanged behaviour).
- errorFormatter rule: genericize only INTERNAL_SERVER_ERROR whose cause is a non-TRPCError AND whose message equals the cause's message (tRPC's wrapping). `toRpcError` builds TRPCErrors with explicit messages + LlmError causes; those keep their messages.
- Env knobs are read from process.env directly (`util/limits.mts`), not through the zod config: an invalid value must never fail `getConfig` (that would take the server down). Invalid → default.
- Quota/limit tests share module-level limiter state per test file process; tests reset via exported reset functions.
- Dependency bump: body-parser 2.4.0 is the only fixed 2.x (published 2026-10-22, 12 days old); @clerk/express 1.7.84 (2026-10-19), path-to-regexp 8.4.2 (2026-04-01). Lockfile also moved shared transitive patches (cookie, qs, content-type, etc.). `npm audit --omit=dev` no longer lists the four packages.
- @trpc/client added as a server devDependency (^11.7.1, already hoisted from the app) for the real-client guard test.
- Criterion 20 mechanical grep — scope: added lines in `git diff main -- 'packages/server/src/**/*.mts'` excluding tests and comment lines; pattern UNAUTHORIZED|UnauthorizedError|401|Token expired|Invalid token → no matches (exit 1). Procedure/input/output lines in the diff: only `export const procedure = trpc.procedure.use(mutationRateLimit);` (middleware), no `.input(` / `.output(` changes.
- Privacy helper check run: `node --experimental-strip-types packages/app/scripts/check-privacy-helpers.mjs` → "privacy helpers: all checks passed".
- CI commands run locally: check:native-modules, check:eas-node, `npm run build`, `npm run test` (391 pass), `build:web` — all green.

## Review triage 2026-11-03
Code review (local-diff mode, fresh-context subagent) + inline minerva audit. Verifier accepted completion.
1. [medium] Express default handler renders stacks when NODE_ENV unset (bad/oversized JSON body) — FIX: terminal errorHandler (54f7950).
2. [medium] errorFormatter hides unexpected errors and nothing logs them server-side — FIX: tRPC onError logger (6738db7).
3. [low] a single list larger than the decrypt budget never succeeds — FIX: limiter charges oversized cost at the max (757d3a0).
4. [low] check-in with journal text refused whole at the journal quota (mood not saved) — SUGGEST: deliberate ("never half-saved"); documented in the knowledge reference. Only affects users at 5,000 entries.
5. [low] server.mts wiring (guard before express.json, headers, x-powered-by) not covered by tests — IGNORE with note: no present defect; wiring verified by Verifier and reviewer; server.mts top-level awaits config, migrations and listen, so a wiring test needs a createApp refactor not worth it here.
6. [low] Clerk bump has no end-to-end token test — SUGGEST: watch 401 rate after deploy; documented in the knowledge reference and the final report. No changelog ships in the package.
7. [low] privacy-helper check not in CI — FIX: CI step runs it directly (f6191db). Gotcha: adding it as an app package.json script changed the native fingerprint to 72f9f8ad…, so it is not a script.
Minerva audit: spec fidelity — all Approach items present; knowledge compliance — additive-only contract held (criterion 20 grep), 401-logout knowledge respected, OTA-by-fingerprint respected (fingerprint re-verified 239adbf6… after every app-side change). Note: the knowledge reference entry was written during work so criterion 1 could be verified; promote reviews it as the single writer.
Inline audit note: chat turns decrypt at most 41 history rows (HISTORY_MAX_MESSAGES + 1), so the decrypt budget never touches normal chat; conversation.get without input decrypts the whole conversation, which only nears the budget past ~5,000 messages refetched several times a minute.
