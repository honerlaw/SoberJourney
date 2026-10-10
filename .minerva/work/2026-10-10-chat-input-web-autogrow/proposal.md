# Proposal: chat-input-web-autogrow

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)
**Replans**: 1 — see replan.md (2026-10-10, web one-line height is 52px)

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

Shipped as Approach A (below), with one review addition: `overflow: hidden` during the read. Files:
- `packages/app/src/components/pages/SponsorPage/ChatInput/ChatInput.tsx`:
  - `clampInputHeight`;
  - `measureWebInputHeight(node)`, which guards for `HTMLTextAreaElement` (with a `__DEV__` warning) and records `border = offsetHeight − clientHeight`. It then saves the inline height, overflow and `scrollTop`, sets `overflow: hidden; height: 0px`, reads `scrollHeight + border`, restores all three in `finally`, and clamps to [44, 140];
  - on web, a `useLayoutEffect` on `[text]` and `onLayout`, with `onContentSizeChange={undefined}`;
  - on native, the same `onContentSizeChange` formula as before.
- `.minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.mjs`: the real-browser harness. Results are in `archive/scratchpad.md`.

The web one-line height is 52px under the default Tamagui size (replan 2026-10-10), and the 44 floor is native-tuned. Knowledge: [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] corrects the web half of [[2026-10-06-reference-rn-web-textarea-keyboard]], and [[2026-10-10-reference-real-browser-component-harness]] documents the harness.

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

1. On web, `ChatInput` passes `onContentSizeChange={undefined}` to the TextArea. On native it still passes it, with the same formula. This is a direct code check. Native has no test runner, so "native unchanged" is verified by reviewing the diff, an accepted limit. If the web ref is not an `HTMLTextAreaElement`, a `__DEV__` warning fires, so the input can't get silently stuck at 44px in development.
2. Real-browser check: a script committed as `.minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.*` bundles the real `ChatInput` through react-native-web and Tamagui with the app's `tamagui.config.ts` (esbuild), and drives headless Chrome. It records the textarea height on every animation frame and asserts each of the following:
   - (a) After mount, every sampled frame for ~1s has the same height, H1. H1 is the measured one-line height: 52px was observed under the default Tamagui size, and the harness does not assert that number. H1 must equal max(44, what one line needs), computed in the page from the textarea's style as vertical padding + line height + borders. One line must also show without clipping (`scrollHeight <= clientHeight`).
   - (b) After typing 3 short lines, the height is greater than H1 and less than 140, and is unchanged over the next 30 frames, with no `onLayout` loop.
   - (c) After typing past the cap, the height is 140, overflow scrolls, and after scrolling the textarea to the bottom and typing another character, `scrollTop` is within 2px of `scrollHeight − clientHeight`.
   - (d) After the text is sent with Enter (`onSend` → `setText("")`), the height returns to exactly H1 and holds there for 30 frames. (d2) A restored `failedDraft` is re-measured. (Both were added at review.)
   - (e) After the container width is halved with multi-line text, the height re-measures larger and is unchanged over the next 30 frames.
   - (f) Run against the pre-fix `ChatInput`, assertion (a) fails, showing the ratchet, which proves the harness detects the bug.

   Output is recorded in the scratchpad / PR body. The harness renders the real `ChatInput` with Tamagui and copies no logic. If that bundle can't be built, stop and replan rather than weaken the evidence. Pre-flight at propose: the esbuild bundle builds, and against current main the textarea is already 140px on the first painted frame.
3. App `npm run build` (tsc), `npm run lint` green.
4. Knowledge entry amended at promote: on web, don't drive height from RNW `onContentSizeChange` (the scrollHeight ratchet); note the ref-callback re-invocation fact. The amendment is a dated note with a link to this unit.

## Open Questions

- The user's report names no platform. The ratchet is web-only (reproduced in a real browser); native `onContentSizeChange` reports text height. If the user still sees the flicker on the iOS TestFlight build after this ships, that is a different cause and a separate unit.
