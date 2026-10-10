# Scratchpad: web-layout-polish

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [reviewed — clean] scope check: one unit, one PR (3 app files + harness) (tier: reviewer — solo denied, three files not a single surface; Skeptic accept, panel no; dismissed: "CurrentStreakCard/TrackerCard use HeaderButton" — false, they import only DurationProgressBar; parallel wave)
- [reviewed — clean] approach: A — HeaderButton web margin $2→$3, web tab bar explicit height 64+inset / padding 8, label position relative + zIndex 1; rejected B (untyped headerTitleContainerStyle cast), C (custom headerTitle fn), D (drop paddingTop only — 12px), E (two-tone text) (tier: reviewer — not single surface; author's knowledge-tension doubt on "no hard-coded tab bar height" passed to Skeptic, who confirmed the constraint is native-tabs scoped; existing-interface: HeaderButton props unchanged, visual only; parallel wave)
- [reviewed — folded] whole-proposal: harness dependency resolution unspecified (root node_modules stale SDK 54) — added Dependencies/Calibration/coverage bullets, Android-not-investigated note, constraint-scoping sentence, criterion 1–3/5 wording (content box, right inset, 100% case, knip) (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: items 7/8/9 partial — added 0% case to criterion 3; JourneyInfoHeader stays a screenshot check; knip/lint-root claim to verify during work
- [solo] restart check: whole-proposal first-wave stands — approach pick and scope unchanged, no scope/approach fold (tier: n/a — wave reconciliation)
- [panel — 3/3 accept, 3 with fixes] mid-work divergence: REPLAN — global HeaderButton margin regresses multi-button non-tab headers (JourneyInfoHeader +24px, title collides at 375px); "consistent across all web headers" premise false → move spacing to TabStackLayout (tab headers only) (tier: panel floor — mid-work load-bearing divergence, quorum 2/3)
    - fix: record Original/What changed/New plan; state the premise was disproved by shots-main vs shots-fixed
    - fix: amend Scope, Approach header bullet, Candidates (B), criterion 1 (ref files), criterion 4 (HeaderButton unchanged, web-guarded wrappers)
    - fix: give numbers 17px gap / 13px insets, justify left paddingStart, symmetric insets
    - fix: harness — gap at 375 + 466 + desktop width, click still lands, no empty wrapper when headerRight absent
    - fix: JourneyInfoHeader no-regression assertion (relative), say which headers it covers
    - fix: concrete disposition for the pre-existing multi-button long-title overlap
    - fix: one-line note on tabBarIconStyle marginVertical auto (UIKit tab item justifyContent flex-start)
- [panel — 3/3 accept, 3 with fixes] new-plan acceptance: header spacing → web-only paddingHorizontal 6 wrappers in TabStackLayout; HeaderButton reverted (tier: panel floor — replan new-plan acceptance, quorum 3/3)
    - fix: deferral argued against the bar — not absorbable (needs header-wide title maxWidth/custom-title decision), fails condition 2 (cosmetic); reference entry 2026-10-10-reference-web-header-title-assumes-one-button-per-side as a standing fact
    - fix: proposal rewritten end to end (Goal, Why, Approach incl. tabBarIconStyle, Candidates, Scope, criteria) — no stale HeaderButton-margin text
    - fix: tab layouts pass one headerRight each, short titles; harness asserts title clears the right button at 375px
    - fix: criterion 2 labelled a baseline-parity smoke check; criterion 1 "17 expected, 16 floor"
    - fix: no-headerRight → undefined, no wrapper (criterion 5, read from code); criterion 5 split diff-check vs code-read
