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
