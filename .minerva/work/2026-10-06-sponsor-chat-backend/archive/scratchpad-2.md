# Scratchpad: sponsor-chat-backend (post-promote replan pass)

> Summarized at minerva:promote on 2026-10-06 — see archive/. This block covers the
> 2026-10-06 replan (crisis guidance) after that promote; it is archived again at re-promote.

## Decisions 2026-10-06
- [escalated to user] ship: permission classifier blocked rebase+merge as "Merge Without Review" — user answered: persist-before-generate approved; auto-review bot removed (#42); `gh pr merge` permitted; add crisis guidance to this PR
- [user-directed] divergence confirmation: crisis guidance added to scope by the owner (no divergence panel; the owner's directive is the justification)
- [panel — 3/3 accept, 3 with fixes] new-plan acceptance: crisis-resource section in systemPrompt.mts + conditional crisis line in SAFETY_FALLBACK_REPLY (tier: panel floor)
    - fix (skeptic/arbiter): acute-danger signs take priority over the craving/relapse carve-out (precedence sentence)
    - fix (skeptic/arbiter): scope the older distraction / "this conversation counts" guidance to ordinary cravings
    - fix (skeptic/arbiter): add severe withdrawal; explicit US mapping 988 (suicide/self-harm) vs 911 (overdose/withdrawal/violence/danger)
    - fix (skeptic/arbiter): SAMHSA when substance use is involved or treatment asked — recorded as deliberate refinement
    - fix (arbiter): replan states PR #41 unmerged (old constant never deployed), lists proposal/knowledge edits, accepted trade-offs; PR body carries a manual smoke list
    - fix (skeptic): fallback shortened
- [reviewed — clean] completion verification (crisis criterion + post-rebase scope): Verifier accept; 183/183 tests after rebase (tier: reviewer floor)
- [solo] review triage (crisis commit): 4 FIX / 1 IGNORE (tier: default-solo row — each FIX had a writable failure scenario and a small fix; #5 informational, old constant never deployed)

- [solo] promote partition (replan pass): 1 PROMOTE (new decision entry 2026-10-06-decision-sponsor-chat-crisis-guidance) + edits to this unit's unmerged entries / MERGE INTO PROPOSAL (crisis approach, neutral fallback) / rest DISCARD / 0 TODO (tier: default-solo row)
## Review triage 2026-10-06 (crisis commit)
1. [medium] crisis-line fallback sent for every block incl. RECITATION/SPII/BLOCKLIST → FIX: fallbackReplyFor(reason); neutral BLOCKED_FALLBACK_REPLY; FALLBACK_REPLIES set in buildHistory.
2. [low] "critical (10/10)" check-in urge could read as a crisis → FIX: carve-out says check-in levels alone are not a crisis.
3. [low] relapse after abstinence = overdose risk → FIX: overdose clause.
4. [low] brittle sentence-matching tests → FIX: token assertions + heading guard.
5. [info] old constant never deployed → IGNORE (true; PR #41 unmerged).

## Work notes 2026-10-06 (replan pass)
- Rebase onto epic/audit-wave-1 (#24, #26, #27, #28, #30, #42) was textually clean; build green, 186/186 tests, lint clean. Reviewer confirmed integration: encryption signatures unchanged (#24 DEK memo keyed on ctx WeakMap, so fire-and-forget generateTitle is safe); #27 removed the context timezone default (column still defaults America/New_York; safeTimeZone falls back to UTC); #27 indexes `[conversationId, createdAt]` suit keyset paging.
