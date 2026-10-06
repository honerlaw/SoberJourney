# Scratchpad: sponsor-chat-client

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-06
- [user-directed] open-issue match: adopting #28 (coordinator brief: user explicitly asked to execute these issues; `**Closes**: #28`)
- [user-directed] pre-flight in-flight check: done by coordinator; 001-sponsor-chat-streaming client scope folded in (read-only)
- [reviewed — clean] scope check: one unit, one PR (tier: reviewer — multi-file, not provably small; Skeptic accept, noted design-level caveats only; parallel wave)
- [reviewed — folded] approach: option A (provider per-conversation pending map + id-coordinated cache append); rejected B (useMutationState-derived pending: success/notify ordering duplicates) and C (refetch + dedupe by server id: field absent on prod server, re-decrypts). Skeptic flagged enabled-toggle over staleTime 0 refetches after every send — folded to staleTime: Infinity + explicit refetch, cache-gone fallback keeps pending until refetch, no double toast verified (tier: reviewer; parallel wave)
- [rechecked — residual folded] approach: item 4 partially (headline criterion carve-out) — folded; item 7 (scope size, low) not load-bearing; new lows folded (refetch-on-select only when cached, null guard in updater, staleTime trade-off stated)
- [reviewed — folded] whole-proposal: refetch toggle, ChatInput boolean contract, types/cache shape/title split, web Enter details, lazy-init premises, criteria gaps (allow-list diff, NOT_FOUND, double send, Android record) (tier: reviewer; parallel wave; no restart — approach pick unchanged, scope/approach folds did not rewrite Goal/Success criteria)
- [rechecked — residual folded] whole-proposal: item 5 partially (shiftKey on onKeyPress unverified) — verified in react-native-web TextInput handleKeyDown (DOM event, shiftKey + isComposing), folded
