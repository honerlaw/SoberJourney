# Scratchpad: chat-input-alignment

## Decisions 2026-10-10
- [solo] in-flight pre-flight: no collision (no open PRs; prior chat-input units #56/#57 merged; no matching open issues) (tier: hardcoded check, clean)
- [solo] scope check: one unit, one PR — ChatInput.tsx + unit verification scripts (tier: solo predicate — single component, additive style props, no interface, no knowledge conflict; parallel wave)
- [reviewed — clean] approach: A explicit typography/padding overrides (16/20/11/14 → 44 = button) over B unstyled restyle and C grow button/center-only (tier: reviewer — visual decision not mechanically verifiable; author doubts flex-end vs center and variant override answered in favour by Skeptic; noted: native cause is a hypothesis gated on device, fallback named; parallel wave)
- [reviewed — folded] whole-proposal: no criterion measured the button vs input; added real-browser rect check (criterion 2), native-hypothesis + fallback (criterion 6), named constants, stale 52px promote item (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: items 3/6/7 partially — residual non-load-bearing (native 44 tied to MIN_INPUT_HEIGHT not the Button token; font change to be noted in PR — folded into Approach)

## Work notes
