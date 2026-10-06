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
