# Scratchpad: conversation-management

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [user-directed] in-flight collision + open-issue match: pre-answered by coordinator brief ("adopting #31"; no overlapping units; no open PRs/branches for the slug)
- [reviewed — clean] scope check: one unit, one PR (tier: reviewer — not provably small: two packages, new procedures; parallel wave). Skeptic noted ownership widening beyond "rename route only" (coordinator assigned route/conversation/** + database/conversation/** additive) — recorded in proposal compatibility note; same-text heuristic and refetch cost concerns overlapped whole-proposal and were folded there.
- [reviewed — clean] approach: retry via new `conversation.retrySponsorChat` + refetch-confirm (A); rejected B (two-step add+generate: rewrites #28 send path, pre-empts #33), C (optional input on released `sponsorChat`); inverted FlatList over FlashList (new dep) / maintainVisibleContentPosition (unsupported on web); rename via raw UPDATE preserving updatedAt (tier: reviewer — introduces new interfaces, no existing consumer; parallel wave). Skeptic hardening suggestions (pre-send id snapshot, newest-page refetch) adopted via the whole-proposal fold.
- [reviewed — folded] whole-proposal: folded pre-send server-id snapshot into "confirmed saved" (identical-older-message false positive lost text = criterion 6 violation), trim-to-newest-page before explicit refetches, message-list dedupe + empty-pages handling, onEndReached guards + web manual check, explicit Save-disabled-on-empty rename, raw SQL table/column verification + rejected explicit-updatedAt alternative, best-effort lock residual, `direction` key note (tier: reviewer; parallel wave)
- [rechecked — residual folded] whole-proposal: items 2 (no web fallback named) and 5 (DBClient $executeRaw — confirmed: getOrCreate already uses it) partial, non-load-bearing; folded web-only non-inverted fallback, single affordance wording "No reply yet · Retry", pageParams trimmed with pages, pending bubble through trim-and-refetch as a verify case
