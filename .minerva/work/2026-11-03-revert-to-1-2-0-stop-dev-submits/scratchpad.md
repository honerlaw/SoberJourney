# Scratchpad: revert-to-1-2-0-stop-dev-submits

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-11-03
- [reviewed — folded] scope check: one unit, one PR (revert + CI dev build without submit + records); TestFlight-only versioning out of scope. Folded: keep #69 open, retitled to the native-change-after-release hazard (the corrected rule makes it predictable), add a build-121-CANCELED criterion, record internal-distribution install path (tier: reviewer — not provably small, three concerns; parallel wave)
- [rechecked — residual folded] scope check: fold-audit accepted; residuals folded — Open Question names build 116 as the alternative to rule out and drops "right either way"; launch check targets the newest group on 239adbf6; TestFlight-eligibility worded as unverified
- [reviewed — clean] approach: version via restore from c4b13c1~1 (not git revert — it would drop #70's records); CI via a direct `eas build` in ci.yml with working-directory (not editing the fingerprinted app package.json script, not deleting the step); records via correction. Skeptic answered the interface doubt: the internal CI step has no outside consumers and the user withdrew the submit. Noted: dev builds likely never TestFlight-eligible (tier: reviewer — interface-clause doubt passed to the Skeptic; parallel wave)
- [reviewed — folded] whole-proposal: in-place knowledge rewrite breaks minerva's add-only wiki rule → superseding entry carrying forward still-true content; criterion 3 reworded to a no-"Scheduling iOS submission" check plus dev build appVersion 1.2.0; restore via git checkout; fingerprint reasoning stated (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: fold-audit accepted; residuals folded — post-merge "Published update group … for runtime 239adbf6" criterion; carry forward the --no-wait submit check and `eas submit --id` resubmission; hedge "receives OTA" pending launch telemetry
