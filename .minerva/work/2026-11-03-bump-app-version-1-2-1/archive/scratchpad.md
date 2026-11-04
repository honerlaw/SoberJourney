# Scratchpad: bump-app-version-1-2-1

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-11-03
- [reviewed — clean] scope check: one unit, one PR; eas-deploy.sh's FINISHED-but-unsubmitted update target excluded (documented accepted behaviour; needs EAS/ASC status queries; not blocking since the new fingerprint has no finished build). Skeptic noted criterion fixes and a missing follow-up disposition — proposal edits, carried by whole-proposal (tier: reviewer — not provably small: excludes a seed-named surface; parallel wave)
- [reviewed — folded] approach: 1.3.0 → 1.2.1. Skeptic showed the 1.3.0 case rested on SDK 57/Liquid Glass being unreleased, which EAS can't confirm (builds 108/110/116 also finished at 1.2.0), and that the user had been told 1.2.1; also lockfile has 4 own-version lines, not 3 (tier: reviewer — version label is a judgment call, solo denied; parallel wave). Rejected: 1.3.0 (unverified feature-release rationale), app.json-only (breaks #47 convention)
- [rechecked — clean] approach: fold-audit confirmed items 1–7 addressed; noted the dev-client CI submission claim is unverified (wording softened)
- [reviewed — folded] whole-proposal (first wave): criterion 2 counted 3 lockfile lines where #47 changed 4; criterion 3 lacked a same-install control (tier: reviewer; parallel wave) — superseded by the restart
- [reviewed — clean] whole-proposal (restart): re-reviewed after the approach pick changed 1.3.0 → 1.2.1. Accept; wording fixes folded (Goal ties ASC acceptance to post-merge step; pick the production build in ASC; hold-merges stop condition; why a JS-only fix still needs a bump; closed-train assumption; CI predict as fallback for criterion 3) (tier: reviewer; parallel wave restart)
- [reviewed — clean] completion verification: Verifier reproduced criteria 1–2, accepted 3–4 on recorded evidence, with the CI half pending at ship (tier: reviewer floor)
- [solo] review triage: 0 FIX / 0 SUGGEST / 0 IGNORE (tier: default-solo row — code review returned no findings)
- [solo] promote partition: 1 PROMOTE (constraint: release closes the version train) / work notes MERGE into proposal / decisions DISCARD / 1 TODO (tier: default-solo row — no entry had two defensible buckets)
- [solo] TODO disposition: eas-deploy update-target defect → GitHub issue #69, priority high (writable failure scenario; it silently stalled OTA 2026-10-11→11-03; needs EAS/ASC status design, too large to absorb) (tier: default-solo row)

## Work notes
- Fresh `npm ci` in the worktree (Node 24.20.0, NPM_TOKEN from ~/.npmrc).
- Control: `eas-deploy.sh predict` on main's version files → production + development fingerprint 239adbf6321f8911c7c50247d7d75c6bc388afe4, "Finished production builds with this fingerprint: 6c7b726a…", "Decision: update".
- Bumped 1.2.0 → 1.2.1 in package.json, packages/app/package.json, packages/app/app.json, packages/server/package.json, and lockfile lines top-level / packages[""] / packages/app / packages/server (8 +/-, same shape as #47).
- After bump: predict → 47106bafcf4cae81c6d36036fff776b0275a6460 (prod = dev), "No finished production build has this fingerprint.", "Decision: build".
- `npm ci --dry-run` accepts the edited lockfile. check:native-modules, check:eas-node, privacy-helper check, build, build:web pass; test 397/397.

## Review triage 2026-11-03
- Verifier: accept (criteria 1–2 met; 3–4 met locally, CI half confirmed at ship).
- Code review (independent diff reviewer): no findings. The dev-client upload from PR CI is noted, already covered by manual step 4.
- Minerva audit: diff matches Goal/Approach/criteria; no knowledge conflict.