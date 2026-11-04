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
- [reviewed — folded] completion verification: Verifier revise on criterion 4 (entry stated "receives OTA" as fact; the required hedge was missing). This was an implementation gap with no change to the criteria, so it was closed in the work; the same Verifier re-checked criterion 4 → accept. 1, 5, 6 met; 2, 3, 8 met locally (PR CI half pending); 7 post-merge (tier: reviewer floor; the gap-fix re-check is an extra dispatch rather than a replan, since no criterion changed)
- [solo] review triage: 0 FIX / 2 SUGGEST / 0 IGNORE. SUGGEST (standing facts): the shared dev/production build-number counter → folded into the new entry; the unused submit.development profile and eas:submit:dev scripts → left as they are (editing the scripts would move the fingerprint), noted in the entry (tier: default-solo row — no item had two defensible dispositions)
- [solo] promote partition: knowledge entry already written in-unit (superseding); work notes MERGE into proposal; decisions DISCARD; 0 new TODO (#69 already rewritten and tracked) (tier: default-solo row)

## Work notes
- Version files restored with `git checkout c4b13c1~1 -- <5 files>`; `git diff c4b13c1~1 -- <5 files>` is empty.
- Fresh `npm ci` (Node 24.20.0). `eas-deploy.sh predict` → production and development fingerprint 239adbf6321f8911c7c50247d7d75c6bc388afe4, "Finished production builds with this fingerprint: 6c7b726a-421c-4682-8307-344a7a318c70", "Decision: update".
- ci.yml's last step is now "EAS development build (no store submit)": `working-directory: packages/app`, `eas build --non-interactive --platform ios --no-wait --profile development`. The app/root package.json scripts are unchanged. YAML parses.
- New knowledge entry 2026-11-03-constraint-version-bump-moves-ota-off-the-released-binary supersedes the 2026-11-03 version-train entry. knowledge_catalog.py renders the old one "(superseded by [[…]])". knowledge_lint: 0 errors (1 pre-existing legacy index.md warning).
- #69 retitled ("A native change merged after an App Store release, without a version bump, turns a rejected build into the OTA target"), body rewritten with a Failure scenario line, correction comment added, still OPEN.
- Production build 121 (1.2.1): CANCELED, no submission.
- check:native-modules, check:eas-node, privacy-helper check, build, build:web pass; test 397/397.

## Review triage 2026-11-03
- Code review: no defects. Notes: submit.development/eas:submit:dev now unused (left; scripts are fingerprinted); dev and production share the remote build-number counter (added to the entry).
- Verifier: accept after the criterion 4 hedge.
