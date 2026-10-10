# Replan log: web-layout-polish

## 2026-10-10 — Header spacing moves from HeaderButton (all web headers) to TabStackLayout (tab headers only)

**Original plan**: Widen the web header title gap by changing `HeaderButton`'s web `marginHorizontal` from `$2` (7px) to `$3` (13px). This was chosen over candidate B (spacing only on tab headers) because it "applies to every web header using `HeaderButton` … consistent".

**What changed**: The unit's own harness took a 375px screenshot of a non-tab, two-button header (`JourneyInfoHeader`: Edit + separator + Delete, long title). Comparing `shots-main/journey-header-375.png` with `shots-fixed/journey-header-375.png` disproved that premise.
- expo-router 57's JS `Header` caps the title at `maxWidth = width − (52|16) − (52|16) − insets`, which assumes one button per side.
- On `origin/main` a long title already runs flush into the right button group. That is a pre-existing bug.
- The global margin grows each button 12px, so a two-button group grows 24px and the title visibly collides with the Edit icon. That regresses a screen the user did not ask about.

The divergence panel voted 3/3 accept, with fixes, that this is load-bearing.

**New plan**: Revert `HeaderButton.tsx`; it is unchanged in the final diff. In `TabStackLayout`, on web only (`Platform.OS === "web"`; native gets exactly today's functions), wrap two things in a view with `paddingHorizontal: 6`:
- the Profile `headerLeft` button;
- the tab's `headerRight` output, only when the tab passes one (`headerRight` stays `undefined` otherwise).

Results on web tab headers:
- The title gap goes from 11 to 17px: 7 button margin + 6 wrapper + the header's 4px title margin.
- Left and right insets both go from 7 to 13px. The left `paddingStart` is what keeps the header symmetric.
- Every tab header (Journeys / Sponsor / Journal) has one Profile button on the left, one button on the right and a short title. The wrappers make each side about 62px against the header's assumed 52, which these titles fit with room to spare. The harness asserts no overlap at 375px.

Non-tab headers (journey info, journal entry, new journal entry) keep today's spacing.

The tab-bar mechanism also gains `tabBarIconStyle: { marginVertical: "auto" }`. The library's UIKit tab item is a `justifyContent: flex-start` column that `tabBarItemStyle` cannot reach, so with labels hidden the icon sat 5px above center. Auto margins center it.

The pre-existing long-title overlap on multi-button web headers is deferred under the deferral bar.
- It is not absorbable (outlet 0): fixing it needs a design decision across every web header, either overriding the JS `Header`'s title `maxWidth` or adding a custom title.
- It fails condition 2: it is cosmetic, so neither critical nor high priority.
- Promote writes it as the reference entry `2026-10-10-reference-web-header-title-assumes-one-button-per-side`, stated as a standing fact.

`proposal.md` is rewritten to match: Goal, Why, Approach, Candidates, Scope and Success criteria.
