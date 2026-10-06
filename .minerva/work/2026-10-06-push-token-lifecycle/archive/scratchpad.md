# Scratchpad: 2026-10-06-push-token-lifecycle

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [reviewed — clean] scope check: one unit, one PR, no phases (tier: reviewer — not provably small; parallel wave). Skeptic noted: state preconditions (#27/#29 merged) and the addPushToken re-enable constraint — carried into the proposal text, not load-bearing for scope
- [reviewed — folded] approach: option A (registerSignOutTask seam + pure lifecycle + platform module + sync hook); folded re-register latch, honest 401 wording, 3 s bound, ref-read deps (tier: reviewer — interface-clause doubt on endSession passed to the Skeptic, who answered no; parallel wave). Rejected: B (needs unowned TRPCProvider/DeleteAccountButton), C (SecureStore persistence, dominated)
- [rechecked — escalated] approach: fold-audit found a load-bearing new concern (latch stuck after same-user re-sign-in; late revoke hazard) → panel
- [panel — 3/3 accept, 3 with fixes] approach: option A with generation counter, null-reset userId ref, same-token dedupe (tier: panel — fold-audit escalation, quorum 3/3)
    - fix (arbiter/skeptic/proponent): success criteria state which revoke paths are client-covered vs server-covered (#26 reassignment, user.remove)
    - fix: sign-out task treats a missing client as no-op and never throws
    - fix: revoke fallback fetch skipped when permission not granted; revokePushToken idempotent and user-scoped
    - fix: sync effect does nothing until Clerk isLoaded
    - fix: web variant registers no sign-out task; unmount-unregister is hygiene only
    - fix: manual PR steps cover the signOut-failure latch; npx tsx is ad hoc, no package.json change
- [reviewed — folded] whole-proposal (restart): first-wave review discarded as stale (approach fold rewrote ## Success criteria); restarted review flagged the same-user re-sign-in latch, foreground re-register dedupe, straggler generation, mutationFn invariant note, provisional status — all folded (tier: reviewer; parallel wave restart)
- [rechecked — clean] whole-proposal: fold-audit confirmed items 1–8 addressed; two test-coverage gaps (in-flight register across startSession; not-loaded transition) added to criteria

## Work notes
- tRPC `mutationOptions().mutationFn` is typed `(variables, context: MutationFunctionContext)` with the app's @tanstack/react-query (nested query-core 5.90.14); the root query-core 5.87.4 has the 1-arg type. Pass `{ client: queryClient, meta: undefined, mutationKey }` from `useQueryClient()` (Routes is inside QueryClientProvider). tRPC 11.8.1 ignores the context.
- Verify script surfaced that a `revoke()` during the token fetch stops the in-flight register before `addPushToken` (the latch check after fetch). That is the desired behaviour; the test was re-sequenced and a dedicated check added.
- `setNotificationHandler` now runs at app start (pushPlatform imported via usePushNotifications.native) instead of on first NotificationSettings import, so foreground notifications show from launch.
- The web branches inside NotificationSettings (WebDateTimeField time picker) are now unreachable because the component renders nothing on web; kept intact (component still exported/used elsewhere) for a future web-push enablement.
- Delete Account: revoke 401s (user gone); 401s are not reported to Sentry from the sign-out task, other failures are.
- Verification: `npx tsx .minerva/work/2026-10-06-push-token-lifecycle/verify-push-lifecycle.ts` → 23 checks pass. Build, server tests (111/111), server lint and `npx expo lint` all exit 0.

## Decisions 2026-10-06 (completion and review)
- [reviewed — clean] completion verification: Verifier reproduced criteria 1–9 (10 "unsure" only because it did not rerun server build/tests; author ran them, exit 0) (tier: reviewer floor — Verifier; no interface change beyond what the proposal approved)
- [solo] review triage: 4 FIX / 0 SUGGEST / 3 IGNORE (tier: default-solo row — no item had two defensible dispositions)

## Review triage 2026-10-06
1. FIX — Android 13+ prompt needs a channel first: `requestPermission()` now calls `ensureAndroidChannel()` before prompting.
2. FIX — a register that finishes after the revoke latch now still remembers its token (same generation), so revoke does not re-fetch it inside the 3 s bound. Verify check updated (no second fetch).
3. FIX — foreground re-registration throttled to once per 6 h after a success (launch/sign-in always registers).
4. IGNORE — mutationFn bypass depends on @trpc/tanstack-react-query internals; the vanilla `useTRPCClient` is not exported from TRPCProvider (not owned) and pinning package.json is out of scope (no package changes). Recorded in the knowledge entry as "re-check on upgrade".
5. IGNORE — simplification depends on 4.
6. IGNORE — optional `withRequestGuard` helper for two call sites.
7. FIX — proposal said "test-only reset"; not needed (verify uses unregister functions). Proposal Approach rewritten at promote; trailing blank line removed.

## Promote 2026-10-06
- [solo] promote partition: 1 PROMOTE (decision entry 2026-10-06-decision-push-token-client-lifecycle, written during work and updated for the review fixes) / 6 MERGE INTO PROPOSAL (review fixes, setNotificationHandler timing, MutationFunctionContext, unreachable web branches, no test-only reset) / rest DISCARD / 0 TODO (tier: default-solo row — no entry had two defensible buckets)
