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
