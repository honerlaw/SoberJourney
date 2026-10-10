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
- [reviewed — clean] completion verification: Verifier reproduced criteria 1–6 (ran the harness normal + --ref origin/main --expect-fail, eslint, tsc); knip identity with main verified by the author, not the Verifier (tier: reviewer floor — panel predicate does not hold: no interface changed beyond the replan-approved TabStackLayout wrappers)
- [solo] review triage: 4 FIX / 0 SUGGEST / 0 IGNORE (tier: default-solo row — each finding had a writable failure scenario and was small enough to absorb; none had two defensible dispositions)

## Work notes
- Root `node_modules` in the main checkout was stale (expo-router 6.0.21 / SDK 54) while package.json pins 57.0.25; expo-router 57 installs nested under `packages/app/node_modules`, and its forked react-navigation lives in `expo-router/build/react-navigation`. A harness resolving from the repo root silently tests SDK 54.
- The user's screenshot showed the pre-#58 header (`HeaderButton forceGlass`: 44px GlassView circle + drop shadow). Main's web header buttons are already flat/transparent.
- Web JS bottom tab bar: height = 49 + insets.bottom unless `tabBarStyle.height` is a number; any `tabBarStyle` padding eats into that fixed height (paddingTop 14 left 35px of items, icons 3.5px off the bottom). The UIKit tab item is a `justifyContent: flex-start` column on the inner `role="tab"` button — `tabBarItemStyle` lands on the outer wrapper and cannot center it; `tabBarIconStyle: { marginVertical: "auto" }` does. At >= 768px the bar uses its beside-icon layout; the same settings center there too.
- Web stacking: an absolutely positioned fill paints over an in-flow Tamagui `Text` regardless of DOM order (CSS paints positioned descendants after in-flow content); native paints later siblings on top. Fix: `position="relative"` + `zIndex={1}` on the in-flow content.
- expo-router 57's JS `Header` (web) sizes the title with `maxWidth = width − (52|16) − (52|16) − insets` — one button per side assumed; the title sits 4px after the left container. Multi-button right slots (JourneyInfoHeader: Edit + separator + Delete) let long titles run into the buttons on main. Not fixed (replan): needs a header-wide title-width decision; cosmetic.
- Harness pattern extended: stub only `expo-router`'s `Stack`/`Tabs`/`router` onto `expo-router/native-stack` + `expo-router/js-tabs` (esbuild onResolve exact-match, so `expo-router/assets/*` still resolve), alias `expo-modules-core` from `expo`'s nested copy, `--ref <git-ref>` loads changed files via an esbuild onLoad plugin, and a `SafeAreaInsetsContext.Provider` override simulates the iOS home-indicator inset.
- App `tsc --noEmit` needs a built server (`packages/server` `npm run build`, with a placeholder DATABASE_URL for prisma generate) because the app imports types from `@onerlaw/soberjourney-server/dist/...`; without it ~58 errors appear in tRPC-typed files. npm 11 also blocks install scripts by default (prisma, esbuild postinstall).

## Review triage 2026-10-10
Code review (local-diff mode, fresh-context subagent) + minerva audit (spec fidelity, knowledge compliance: no findings).
1. FIX (medium) worktree `node_modules` symlinks untracked — `node_modules/` ignore pattern does not match symlinks; remove before ship, stage named paths only.
2. FIX (low) TabStackLayout JSDoc said "only 4px" — reworded to 7px button margin + 4px title margin, 11 -> 17.
3. FIX (low) harness measured header insets against the tab bar's tablist — now measured against the header row (closest common ancestor of both header buttons).
4. FIX (low) tab-bar checks only at 466px portrait — added a 1280px (beside-icon layout) run; fails on main, passes on the branch.
