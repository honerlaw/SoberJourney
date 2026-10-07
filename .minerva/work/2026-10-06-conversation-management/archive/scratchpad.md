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
- [reviewed — clean] completion verification: Verifier reproduced criteria 1–6 (server tests 204/204, verify 20/20, app tsc); criterion 7's PR-body part pending ship (tier: reviewer floor — no existing interface changed beyond the approved new procedures; generateReply extraction is internal)
- [solo] review triage: 9 FIX / 0 SUGGEST / 1 IGNORE-part (tier: default-solo row — every finding had a writable failure scenario and a bounded fix; none had two defensible dispositions). IGNORE-part: CR6 latency (refresh uses the query retry policy, up to ~7s with the pending bubble on a dead network) — accepted, bounded, and the pending bubble keeps the text visible.
- [solo] review triage (re-review round): 5 FIX / 0 SUGGEST / 0 IGNORE (tier: default-solo row — all low, bounded fixes, no item with two defensible dispositions)
- [solo] promote partition: 3 PROMOTE (decision rename/retry procedures, decision client paginated cache + failed-send outcomes incl. TanStack race facts, constraint tamagui web onLongPress) / MERGE (classifier, delete NOT_FOUND confirm, guards, native-only long-press into proposal Approach) / DISCARD (decision log, triage records) / 0 TODO (tier: default-solo row — no entry with two defensible buckets)

## Review triage 2026-10-06
Local-diff mode (fresh-context subagent) code review + inline minerva audit.
- CR1 [high] web click on a drawer row also fired onLongPress (tamagui web press calls both) → FIX: onLongPress native-only.
- CR2 [medium] fetchNextPage racing send/retry/refresh dropped appends / refresh joined the page fetch → FIX: loadOlderMessages blocked while pending/refreshing; refreshConversation cancels in-flight fetches and refetches with cancelRefetch: true.
- CR3 [medium] lost response with message+reply saved still restored the draft → FIX: classifyFailedSend (not-saved / saved-unanswered / answered); verify cases added.
- CR4 [medium] FlatList kept the previous conversation's scroll offset → FIX: key by conversationId.
- CR5 [low] NOT_FOUND on delete also covers DB errors / unknown procedure → FIX: confirm against a fresh list before treating as deleted; toast otherwise.
- CR6 [low] error toast shown even when the message was saved → FIX: toast only when not saved, softer toast when saved without reply, none when answered. Latency part → IGNORE (above).
- CR7 [low] provider orchestration untested → FIX via PR manual steps (send while loading older, switch after scrolling up, web row click).
- CR8 [low] no retry tests for blocked/truncated → FIX: 2 tests added (206/206).
- CR9 [low] duplicated LIST_PLACEHOLDER_TITLE → FIX: exported from conversationCache.
- A1 [low, minerva audit] proposal says Retry (error view) trims before refetch; retryConversation did a full refetch → FIX.
Spec fidelity otherwise matches Approach 1–8; knowledge compliance: no `get` invalidation on the send path, lock reused, database exports take (logger, client).
- Re-review of fix commit 2c8af08 (fresh-context reviewer): CR1–CR9/A1 confirmed fixed; 5 new low findings all FIX: per-query fetchStatus guard on older-page loads (overlapping refreshes), NOT_FOUND delete check uses a one-off full `list` under its own key (no joining an in-flight drawer fetch, no clobbering the drawer query's retry options), "answered" failed sends still reported, rename cancels an in-flight older-page fetch before writing the title (not during send/refresh), web-specific a11y hint.
