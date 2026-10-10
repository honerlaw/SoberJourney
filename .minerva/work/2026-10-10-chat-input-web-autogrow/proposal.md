# Proposal: chat-input-web-autogrow

**Date**: 2026-10-10
**Status**: Draft

## Goal

Stop the Sponsor chat tab on **web** from rapidly expanding, scrolling and flickering when it opens, by fixing the runaway auto-grow of the chat input (`packages/app/src/components/pages/SponsorPage/ChatInput/ChatInput.tsx`).

- On web, the input opens at one line (44px) and stays there with no growth frames on mount, grows as the user types multiple lines (capped at 140px), and shrinks back when text is deleted or sent.
- Native (iOS/Android) behaviour is unchanged.
- Client-only change; no server/API change (released-app compatibility unaffected).

## Why

User report: "rapid expanding and scrolling and flickering on the chat screen" still happens after #54. Diagnosis (this session):

- `ChatInput` sets `height` from `onContentSizeChange` as `clamp(contentSize.height + 20, 44, 140)`.
- Tamagui 1.141.5 `TextArea` on web is react-native-web 0.21.2 `TextInput` (multiline → DOM `<textarea>`, `borderWidth: 1`). RNW reports `contentSize.height = hostNode.scrollHeight` (`react-native-web/dist/exports/TextInput/index.js:191-208`).
- A textarea's `scrollHeight` is never smaller than its own client height, even when empty. So each report is "current height − borders", +20 → a bigger height → a bigger report. Headless Chrome reproduction with the same formula: 42→62, 60→80, 78→98, 96→116, 114→134, 132→140 (six growth steps).
- RNW re-runs `handleContentSizeChange` on **every render**, not only on input: the inline `onContentSizeChange` arrow is a new function each render, which changes `handleContentSizeChange` → `imperativeRef` (useMemo) → React re-invokes the ref callback, which calls `handleContentSizeChange(hostNode)`. So the ratchet runs on mount with an empty input.
- Each step shrinks the inverted `FlatList` above the input, which re-lays out and visibly scrolls → the expand/scroll/flicker. `ChatInput` is keyed by `conversationId`, so it remounts at 44px and replays the ratchet on every tab open and conversation switch. It also never shrinks after a long message.
- Ruled out: older-message pagination cascade (prod logs show exactly one `conversation.get` per tab open).
- Native `onContentSizeChange` reports the text content height, so no loop on iOS/Android.

## Approach

### Candidate approaches

**A (recommended). Web-only DOM measurement; native keeps `onContentSizeChange`.**
On web, do not pass `onContentSizeChange`. RNW's `handleContentSizeChange` is gated on `multiline && onContentSizeChange` (`react-native-web/dist/exports/TextInput/index.js:191-192`), so the ratchet path goes inert. A `measureWebHeight()` helper reads the host `<textarea>`. In RNW 0.21 a `TextInput` ref is the DOM host node with RN methods patched on, and Tamagui 1.141.5 `TextArea` on web is `styled(TextInput)` from react-native-web. Steps:
1. Read `inputRef.current`, cast it, and guard with `instanceof HTMLTextAreaElement` (no-op otherwise).
2. Record `border = offsetHeight − clientHeight`, the previous inline `style.height`, and `scrollTop`.
3. Set inline `style.height = "0px"`, then read `scrollHeight`, which is content plus padding.
4. In a `finally`, restore the previous inline height and `scrollTop`.
5. Set `setInputHeight(clamp(scrollHeight + border, 44, 140))`.

Inline style beats the Tamagui/RNW class styles during the read. The 44px floor is applied only by the clamp, so any Tamagui `minHeight` or size-variant height must not affect the measurement; the harness asserts this. Unlike native, where the 20 in the formula is padding plus border, web adds only the border, because `scrollHeight` already includes padding.

The helper is called from:
- a `useLayoutEffect` on `[text]`, which runs after React commits the controlled value and before paint, so the temporary 0px is never painted;
- `onLayout` on web, so it re-measures when a width change re-wraps lines.

The measurement does not depend on the current height, so it cannot feed back. A height change that fires `onLayout` re-measures to the same value, and `setInputHeight` bails out on it, so there is no ping-pong. (`scrollEnabled` is native-only — RNW ignores it; web overflow is the textarea's default `overflow: auto`.) React 19.1 no longer warns about `useLayoutEffect` during static web rendering. The native path is unchanged byte for byte.

**B. CSS `field-sizing: content` + `min-height`/`max-height` on web.** Rejected: unsupported in Firefox and only recent Safari; leaves the ratchet code in place unless also removed; can't be expressed through Tamagui/RNW style props reliably.

**C. Keep `onContentSizeChange` on web but treat `scrollHeight` as total height (drop the +20, add borders) and memoize the callback.** Stops the mount ratchet, but `scrollHeight ≥ clientHeight` means the box can never shrink after a long message is sent or deleted. Dominated by A.

### Scope

One unit, one PR. Files: `ChatInput.tsx`; a real-browser verification script committed in the work-unit dir (`.minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.*`, the same convention as `2026-10-07-sponsor-chat-streaming/verify-sponsor-chat-streaming.ts`). `packages/app` has no test runner (`"test": "echo ..."`), and jsdom mocks of layout metrics cannot exercise the feedback loop, so no jest infra is added. Knowledge update to `.minerva/knowledge/2026-10-06-reference-rn-web-textarea-keyboard.md`, which currently prescribes "drive `height` from `onContentSizeChange`" for all platforms. That is wrong on web, and the entry gets amended at promote with a dated web-exception note and a link to this unit, not rewritten silently.

## Success criteria

1. On web, `ChatInput` passes no `onContentSizeChange` to the TextArea. On native it still passes it, with the same formula. Verified by reading the code, and by the harness in criterion 2 showing no mount growth, which can only hold if the RNW path is inert.
2. Real-browser check: a script committed as `.minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.*` bundles the real `ChatInput` through react-native-web and Tamagui with the app's `tamagui.config.ts` (esbuild), and drives headless Chrome. It records the textarea height on every animation frame and asserts each of the following:
   - (a) After mount, the height stays at 44px for ~1s, with zero changes.
   - (b) After typing 3 lines, the height grows to a value in (44, 140) and holds across frames, with no `onLayout` loop.
   - (c) After typing past the cap, the height is 140, overflow scrolls, and after scrolling the textarea to the bottom and typing another character, `scrollTop` is within 2px of `scrollHeight − clientHeight`.
   - (d) After clearing the text, the height returns to 44.
   - (e) After the container width is narrowed with multi-line text, the height re-measures larger and then stays stable.
   - (f) Run against the pre-fix `ChatInput`, assertion (a) fails, showing the ratchet, which proves the harness detects the bug.

   Output is recorded in the scratchpad / PR body.
3. App `npm run build` (tsc), `npm run lint` green.
4. Knowledge entry amended at promote: on web, don't drive height from RNW `onContentSizeChange` (the scrollHeight ratchet); note the ref-callback re-invocation fact. The amendment is a dated note with a link to this unit.

## Open Questions

- The user's report names no platform. The ratchet is web-only (reproduced in a real browser); native `onContentSizeChange` reports text height. If the user still sees the flicker on the iOS TestFlight build after this ships, that is a different cause and a separate unit.
