# Scratchpad: chat-input-alignment

## Decisions 2026-10-10
- [solo] in-flight pre-flight: no collision (no open PRs; prior chat-input units #56/#57 merged; no matching open issues) (tier: hardcoded check, clean)
- [solo] scope check: one unit, one PR — ChatInput.tsx + unit verification scripts (tier: solo predicate — single component, additive style props, no interface, no knowledge conflict; parallel wave)
- [reviewed — clean] approach: A explicit typography/padding overrides (16/20/11/14 → 44 = button) over B unstyled restyle and C grow button/center-only (tier: reviewer — visual decision not mechanically verifiable; author doubts flex-end vs center and variant override answered in favour by Skeptic; noted: native cause is a hypothesis gated on device, fallback named; parallel wave)
- [reviewed — folded] whole-proposal: no criterion measured the button vs input; added real-browser rect check (criterion 2), native-hypothesis + fallback (criterion 6), named constants, stale 52px promote item (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: items 3/6/7 partially — residual non-load-bearing (native 44 tied to MIN_INPUT_HEIGHT not the Button token; font change to be noted in PR — folded into Approach)

## Work notes
- Root cause confirmed on web in real Tamagui: pre-change textarea computed 14px/24px line, 13/16 padding → 52px vs 44px button, tops 8px apart (verify-chat-input-alignment.mjs --component pre-change).
- ChatInput.tsx: named constants INPUT_FONT_SIZE 16 / INPUT_LINE_HEIGHT 20 / INPUT_PADDING_VERTICAL 11 / INPUT_PADDING_HORIZONTAL 14 passed as explicit TextArea props on all platforms; they override the size variant (proved on web by computed styles).
- Verification run 2026-10-10: alignment props check PASS (FAIL on pre-change); alignment browser check PASS (FAIL on pre-change); #56 web harness 7/7 PASS with H1=44; #57 native props 3/3 PASS; prettier clean; tsc 0 errors in ChatInput.tsx (37 pre-existing elsewhere).
- eslint could not run locally: main checkout node_modules has eslint-plugin-react-hooks 5.2.0, but eslint-config-expo 57 references `react-hooks/set-state-in-effect` (v7 rule) → config load TypeError before linting any file. Environment staleness from the SDK 57 upgrade, unrelated to this diff; CI has no lint job.
- Worktree uses a gitignored symlink to the main checkout's node_modules; playwright-core installed in the session scratchpad, not the repo.
