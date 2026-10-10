# Scratchpad: chat-input-web-autogrow

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [solo] open-issue match: no open issue tracks this (only epic #34, whose issues are closed) — no user contact
- [solo] in-flight check: no in-flight units, no open PRs; branch fix/chat-tab-flicker (#54, merged) is adjacent, not a collision; peers not messaged (no user authorization)
- [solo] scope check: one unit, one PR (tier: solo predicate — one component file (ChatInput.tsx) + a verify script in the unit dir + a knowledge amendment, client-only, additive, no interface; parallel wave)
- [panel — 3/3 accept, 3 with fixes] approach: option A (web DOM measurement; native keeps onContentSizeChange); rejected B (field-sizing: content — no Firefox/older Safari) and C (scrollHeight-as-total — can never shrink) (tier: panel — knowledge tension with 2026-10-06-reference-rn-web-textarea-keyboard, which prescribes onContentSizeChange on all platforms; parallel wave)
    - fix: try/finally restore of inline height + save/restore scrollTop around the 0px collapse
    - fix: 44 floor via clamp only; harness asserts Tamagui minHeight/size-variant don't affect measurement; criterion 3 expanded (past-cap + scroll, clear, onLayout no-loop, width change); web ref cast + instanceof guard; RNW gating cited
    - fix: knowledge entry amended with dated web-exception note + link, not silently rewritten; native 20 = padding+border vs web scrollHeight+border noted
- [reviewed — folded] whole-proposal: first-wave Skeptic accepted but flagged mocked-jsdom unit tests prove nothing (+ main model found packages/app has no test runner) → criterion 2 replaced by a committed real-browser verify script in the unit dir (tier: reviewer; parallel wave)
- [reviewed — clean] whole-proposal (restart): re-reviewed because the approach fold rewrote ## Success criteria; Skeptic accept, no load-bearing items; adopted its clarifications (direct onContentSizeChange={undefined} check, __DEV__ warning on ref-guard miss, numeric tolerances, no-weakening rule for the harness, platform note in Open Questions, scrollEnabled is native-only) (tier: reviewer; restart replaced the fold-audit since the whole draft was re-reviewed)
- [panel — 3/3 accept, 3 with fixes] divergence: web one-line height measures 52px (13+13 padding, 24 line, 2 border), not 44 → criteria error, replan (tier: panel floor — mid-work divergence)
    - fix: restate (a)/(d) relationally (mount == cleared == measured one-line height), not a hardcoded 52
    - fix: raise (b)'s lower bound to the one-line height
    - fix: record that the 44 floor is native-tuned and inert on web at the default size; no padding change
- [panel — 3/3 accept, 3 with fixes] replan acceptance: replan.md entry 2026-10-10 + criteria (a)/(b)/(d) amended (tier: panel floor — new-plan acceptance)
    - fix: no-clipping assertion at H1 (scrollHeight <= clientHeight); grep citation for MIN_INPUT_HEIGHT; (c)/(e) unchanged stated
    - fix: (f) shown to fail the restated (a); H1 captured from (a) in the same run; 52 observed, not asserted
    - fix: "3 short lines" stays under the cap; the divergence panel's fixes are stated as incorporated

## Work notes
- Harness pre-flight surprise: the pre-fix ratchet completes BEFORE the first painted frame (every sampled frame = 140; scrollHeight 138 == clientHeight 138 with an empty box). So the "stable height" form of (a) alone passes on pre-fix code. (a) now also asserts H1 == max(44, padding + line-height + borders from computed style), which makes (f) fail as intended. This is a write-up-level tightening within the accepted replan ("H1 is the measured one-line height"); proposal + replan.md wording updated to match.
- Worktree has no node_modules: ran with a symlink to the main checkout's node_modules (not committed). playwright-core 1.57.0 installed in the session scratchpad only; Chrome channel.
- tsc: 22 errors both on the main checkout and in the worktree, all in ConversationProvider/usePushTokenSync (tRPC types from a stale local server build); none in ChatInput. eslint on ChatInput.tsx: clean.

## Verification output 2026-10-10
Fixed ChatInput:
    PASS (a) mount holds one-line height H1=52, frames=63 heights=[52]
    PASS (b) 3 lines grow and hold, heights=[100]
    PASS (c) capped at 140px and scroll kept, heights=[140] before={"scrollTop":248,"max":248} after={"scrollTop":248,"max":248}
    PASS (d) cleared shrinks to H1=52, heights=[52]
    PASS (e) width halved re-measures and holds, wide=76 narrow=[140]
    PASS no page errors []
Pre-fix ChatInput (origin/main, --expect-ratchet):
    FAIL (a) mount holds one-line height H1=140, frames=63 heights=[140]: one-line need {"scrollHeight":138,"clientHeight":138,"need":52}
    OK (f): pre-fix ChatInput ratchets on mount
