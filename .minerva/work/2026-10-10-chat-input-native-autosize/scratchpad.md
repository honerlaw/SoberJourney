# Scratchpad: chat-input-native-autosize

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [solo] in-flight check: no in-flight units, no open PRs; only remote branch 2026-10-10-chat-input-web-autogrow (#56, merged) — adjacent, not a collision; open-issue match: none (epic #34 only); peers not messaged (no user authorization)
- [solo] scope check: one unit, one PR (tier: solo predicate — one component file + a verify script + one add-only knowledge entry, client-only, no interface; parallel wave)
- [panel — 3/3 accept, 3 with fixes] approach: option A (native Yoga auto-size: minHeight/maxHeight, no JS height/onContentSizeChange/scrollEnabled); rejected B (keep onContentSizeChange minus +20, no scrollEnabled toggle — still feeds post-layout contentSize back) and C (hidden mirror Text — fragile metric parity) (tier: panel — knowledge tension: 2026-10-10 constraint says native keeps onContentSizeChange; 2026-10-06 reference prescribes it; parallel wave)
    - fix: narrow Goal to "removes the JS content-size feedback path"; add convergence sentence (measure depends on text + width, not height); keyboard-padding path promoted to an explicit risk
    - fix: Android = same path, unverified; natural one-line height (44 only a floor), trailing newline and internal scroll past cap added to the device check
    - fix: knowledge entry corrects both the 2026-10-06 advice and the 2026-10-10 native sentence (add-only), mechanism labeled inferred; automated native prop check added to criterion 1; INPUT_VERTICAL_PADDING grep-confirmed single-use
- [reviewed — clean] whole-proposal (first wave): Skeptic accept; clarifications (omit height on native via spread, inferred mechanism, pre-merge behavior gap) all covered by the approach fold (tier: reviewer; parallel wave)
- [reviewed — clean] whole-proposal (restart): re-reviewed because the approach fold rewrote ## Goal / ## Success criteria; Skeptic accept, nothing load-bearing; adopted: Scope's Android wording aligned to "expected, unverified"; merge ≠ completion, with an explicit device-confirm ask stated in criterion 5; noted: explicit `undefined` rows/numberOfLines resolves to height "auto" (variant uses `props.rows ?? props.numberOfLines`) (tier: reviewer; parallel-wave restart)

## Work notes
- Root cause evidence (code path, RN 0.81.5 Fabric): RCTTextInputComponentView updateLayoutMetrics re-emits onContentSizeChange whenever contentSize differs (every layout pass); RCTUITextView contentSize = max(super, placeholderSize) and includes textContainerInset (padding) — so the +20 double-counted padding, and JS height ↔ native contentSize formed a feedback loop; scrollEnabled toggled at the cap. Not reproduced on a simulator: no iOS runtime installed and only 14 GB free.
- Fabric BaseTextInputShadowNode::measureContent measures attributed text (placeholder when empty) within layout constraints and clamps → native auto-size; Tamagui native textAreaSizeVariant gives height "auto" when rows/numberOfLines are undefined.
- Worktree uses a temporary node_modules symlink to the main checkout (never committed).
- eslint clean; tsc: same 22 pre-existing errors as main (ConversationProvider/usePushTokenSync, stale local server types), none in ChatInput.
- Verification: verify-chat-input-native-props.mjs → PASS ios/android {minHeight:44,maxHeight:140}, PASS web {height:44,onLayout:fn}; against origin/main ChatInput → FAIL ios {height:44,onContentSizeChange:fn,scrollEnabled:false} (as required). Web harness (2026-10-10-chat-input-web-autogrow) against the new ChatInput: all PASS (a) 52 / (b) 100 / (c) 140 + mid-text scroll kept / (d) send→52 / (d2) / (e) / no page errors.

## Review triage 2026-10-10
Completion: Verifier accept (reran both scripts incl. pre-fix failure; criteria 4/5 correctly deferred; its prettier warning came from an npx-downloaded prettier — repo prettier is clean, as on #56). Code review (local-diff mode): 0 high/medium, 5 low. Minerva audit (inline): spec fidelity OK; knowledge: the planned add-only correction of the 2026-10-06 reference and the 2026-10-10 constraint (promote); tamagui getButtonSized sets height but textAreaSizeVariant overrides it last with "auto".
1. IGNORE — inputHeight/useLayoutEffect inert on native; already commented "Web only".
2. FIX — Android default vertical centering in the 44 floor box; added textAlignVertical="top".
3. FIX — empty input measures the placeholder (may wrap on narrow/large Dynamic Type) → added to the criterion 5 device check.
4. FIX — verify script leaked its mkdtemp dir (now removed) and its scope (does not exercise Tamagui variant resolution / native layout) is now stated in its header.
5. IGNORE — knowledge entry lands at promote by design.
- [solo] review triage: 3 FIX / 0 SUGGEST / 2 IGNORE (tier: default-solo row — each FIX small with a writable scenario; no item had two defensible dispositions)
- [reviewed — clean] completion verification: Verifier reproduced criteria 1–3, 4/5 deferred by design (tier: reviewer floor — no panel clause; interface unchanged beyond the approved native prop set)
