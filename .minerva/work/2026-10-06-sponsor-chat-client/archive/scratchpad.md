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
- [reviewed — clean] completion verification: Verifier reproduced all 16 criteria (tsc, lint, allow-list, greps; manual items judged from code); 3 minor notes fed to triage (tier: reviewer floor — no interface change beyond the approved proposal)
- [solo] review triage: 10 FIX / 0 SUGGEST / 4 IGNORE (tier: default-solo row — every finding had one dominant disposition: writable failure scenario -> FIX; known/no-scenario -> IGNORE)

- [solo] promote partition: 2 PROMOTE (decision cache model; reference RN-web/TextArea/Android keyboard) / approach already merged / DISCARD gate logs + useToastError-throw note (#29 owns root cause) (tier: default-solo row — no entry with two defensible buckets)
- [solo] TODO disposition: post-#25 failed-generation duplicate -> below issue bar (not critical/high, no immediate failure on prod) -> recorded in decision entry Implications for #31/#33 (tier: default-solo row)

## Review triage 2026-10-06
Code review: local-diff mode (fresh-context subagent). Minerva audit: no spec-fidelity or knowledge findings (wiki empty).
1. [high] handleError (useToastError JSON.parse) can throw inside sendMessage/init catch -> sendMessage rejects, no toast — FIX: non-throwing `showError` wrapper falling back to `report`
2. [medium] Tamagui TextArea default 4-line fixed height (rows/numberOfLines) -> no growth, maxHeight inert — FIX: override rows/numberOfLines, height from onContentSizeChange clamped 44..140
3. [medium] header title stale after async title generation (get not refetched) — FIX: fall back to list title (not the "New conversation" placeholder)
4. [medium] per-query retry dropped default UNAUTHORIZED exclusion; malformed id is BAD_REQUEST — FIX: no retry on UNAUTHORIZED/FORBIDDEN/NOT_FOUND/BAD_REQUEST; BAD_REQUEST shown as not-found
5. [low] title timers array reassigned -> cleanup misses timers — FIX: Set mutated in place
6. [low] GC'd-cache refetch fallback is a no-op — FIX: removed; proposal step 3 rewritten
7. [low] Safari IME Enter (keyCode 229) — FIX
8. [low] late getOrCreate failure after a drawer pick shows spurious init error/toast — FIX: ignore when a conversation is already selected
9. [low] proposal claim "cannot happen on current server" inaccurate (model-message save failure) — FIX: wording
10. [low] Retry button lacks pending feedback — IGNORE (cosmetic, request dedupes)
11. [low] unused MessageRole export / isThinking alias / ref write in render — IGNORE (harmless; isThinking kept as the context's semantic name)
12. [low] no app test coverage — IGNORE (known; manual matrix in PR body)
13. [info] CLAUDE.md naming drift — IGNORE (not this diff)
V. [low] Verifier: getOrCreate resolving without id leaves spinner — FIX: treated as init error

## Work notes
- Gate wave folds: staleTime: Infinity + explicit refetch (select-if-cached / retry / failure) replaced the enabled-toggle, which would have refetched after every send.
- react-native-web passes the DOM keyboard event to onKeyPress (shiftKey, nativeEvent.isComposing, keyCode); onSubmitEditing doesn't fire for multiline without blurOnSubmit.
- Tamagui TextArea defaults rows/numberOfLines = 4 and derives a fixed height from it (textAreaSizeVariant) — must override for an auto-growing input.
- useToastError.handleError can throw on non-JSON TRPC error messages (network errors) — #29 owns the fix; callers in this unit wrap it.
- Android: app.json edgeToEdgeEnabled: true, no softwareKeyboardLayoutMode -> window not resized; manual padding retained; device check pending.

