# Proposal: chat-input-native-autosize

**Date**: 2026-10-10
**Status**: Draft

## Goal

Stop the Sponsor chat input on the **native iOS app** from resizing up and down continuously, which makes the whole screen flicker, by removing the JavaScript content-size feedback path. On native, React Native sizes the multiline input to its content between 44px and 140px during layout, and JavaScript never sets its height.

- On native, the input sits at its natural one-line height when empty. That height is its padding plus one line plus border; 44px is only a floor, so the empty height may differ slightly from today's. It grows with typed lines up to 140px, then scrolls internally, and shrinks after a send.
- Android goes through the same code path, but has not been verified on Android.
- Web keeps the #56 measurement path unchanged.
- Client-only. No server or API change, so released apps are unaffected.

## Why

User report (iOS app): "the chat box / text input at the bottom of the screen is consistently resizing rapidly causing the entire screen to flicker back and forth (up and down)".

Native code path today (`packages/app/src/components/pages/SponsorPage/ChatInput/ChatInput.tsx`, after #56):

```
height = clamp(contentSize.height + 20, 44, 140)   // onContentSizeChange
scrollEnabled = height >= 140
```

The facts below come from react-native 0.81.5 with the new architecture (Fabric), which `app.json` enables with `newArchEnabled: true`.

1. **iOS re-emits `onContentSizeChange` on every layout pass**, not only on text input. `RCTTextInputComponentView.mm` `updateLayoutMetrics:` sets the backing text view's frame and `textContainerInset`, then emits `onContentSizeChange` whenever `_backedTextInputView.contentSize` differs from the previous value (lines 355-369). So every height we set causes a new contentSize report, which is a feedback path.
2. **`contentSize` already includes the padding.** `RCTUITextView.mm` `contentSize` returns `max(super.contentSize, placeholderSize)`, documented as "DOES contain textContainerInset (aka padding)". The +20 therefore double-counts the padding, so the box is always taller than its content needs.
3. **UIKit `contentSize` depends on the frame and on the scroll mode.** It comes from the `UITextView`/`UIScrollView` layout state. With `scrollEnabled` toggling at the 140 cap, the reported size changes between the scrolling and non-scrolling modes. This is the probable mechanism of the observed perpetual oscillation:
   - The box grows by +20 per layout pass.
   - At 140, scrolling turns on and the reported content size drops to the real text height.
   - The height drops, scrolling turns off, and the box climbs again.

   This is **inferred from the code path**. It could not be reproduced on a simulator: no iOS simulator runtime is installed, and only 14 GB of disk is free, which is not enough for a runtime plus a native build.

Whatever the exact UIKit semantics, this loop exists only because JavaScript sets the height from a size the native view reports back after layout. Removing the JavaScript content-size feedback path removes that loop.

## Approach

### Candidate approaches

**A (recommended). Native auto-size via Yoga.** On native, pass no `height`, no `onContentSizeChange` and no `scrollEnabled`. Pass `minHeight={44}` and `maxHeight={140}`. Fabric's `BaseTextInputShadowNode::measureContent` measures the attributed text for a multiline input, or the placeholder when it is empty, inside the layout constraints, and clamps it (`BaseTextInputShadowNode.h:71-90, 132-134, 201-244`). The box therefore sizes to its content during layout, with no JavaScript round trip.

Tamagui 1.141.5's native `textAreaSizeVariant` sets `height: "auto"` when `rows`/`numberOfLines` are undefined (`helpers/inputHelpers.native.js:30-31`). `ChatInput` already passes both as undefined, so `minHeight`/`maxHeight` take effect. A multiline TextInput scrolls internally by default once its content exceeds `maxHeight`.

Web is unchanged: it keeps `height={inputHeight}`, the measured path and `onLayout`. `scrollEnabled` is removed on both platforms, because RNW ignores it and native uses the default. `INPUT_VERTICAL_PADDING` (native only) is deleted.

Native auto-size converges, because the shadow-node measure depends on the text and on the available width (multiline passes the full layout constraints), not on the box's own height. Setting the frame cannot change the next measurement. `inputHeight` and its layout effect remain, but are web-only; on native they never reach the TextArea. `INPUT_VERTICAL_PADDING` has no other readers (grep).

**B. Keep `onContentSizeChange` on native, drop the +20, and stop toggling `scrollEnabled`.** Rejected: it still feeds a post-layout UIKit `contentSize` back into layout, and that size is re-emitted on every layout pass (fact 1). Any frame-dependence in UIKit's `contentSize` still loops. It is dominated by A, which has no feedback path at all.

**C. Measure through a hidden mirror `<Text>` with the same font and width, via `onLayout`.** Rejected: more code, and the font, padding and wrap-metric parity is fragile. It is dominated by A, which measures with the TextInput's own shadow node.

### Scope

One unit, one PR. Files:
- `ChatInput.tsx`;
- a new knowledge entry, add-only, that links to and corrects both the 2026-10-06 reference advice to "drive `height` from `onContentSizeChange`" and the 2026-10-10 constraint's native sentence. Its mechanism claims (facts 1-3) are labeled as inferred.

Android uses the same new-architecture path, so it is expected to get the same fix, but this is unverified.

## Success criteria

1. On native (iOS and Android), the `ChatInput` TextArea's sizing props are exactly `{minHeight: 44, maxHeight: 140}`: no `height`, no `onContentSizeChange`, no `onLayout`, no `scrollEnabled`, and `rows` and `numberOfLines` undefined. On web they are exactly `{height: inputHeight, onLayout}`. This is checked automatically by `.minerva/work/2026-10-10-chat-input-native-autosize/verify-chat-input-native-props.mjs`, which bundles the real `ChatInput` with esbuild against stubbed `react-native` (switchable `Platform.OS`) and `tamagui` (records the TextArea props), then renders it with react-dom/server. Against the pre-fix `ChatInput` it must fail.
2. The web harness (`.minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.mjs`) still passes every assertion against the new `ChatInput`, so web did not regress.
3. App `tsc` shows no new errors in `ChatInput.tsx`, and eslint and prettier are clean. CI Build and Test are green.
4. A knowledge entry records the iOS mechanism and the native auto-size rule. It links to, and corrects, the native sentence in the 2026-10-10 constraint entry. Under promote's add-only rule, the old entry is not edited.
5. Manual check on device, done by the user after merge through TestFlight. No simulator is available here, so this is recorded as user-verified post-merge and is the only check of native behavior. On the iOS Sponsor tab:
   - the input does not oscillate;
   - it is one line when empty, at its natural height;
   - it grows while typing;
   - a trailing newline shows its caret line;
   - it scrolls internally past the cap (this relies on React Native's default multiline scrolling, since `scrollEnabled` was removed);
   - it shrinks after sending.

   The fix is not called confirmed until this check passes. Merging is not completion: the user is asked to confirm on device, and if the check fails, the follow-up is a new unit that starts with the keyboard-padding suspect.

## Risks

- **The cause is inferred, not reproduced.** If the flicker persists on device, the next suspect is the keyboard padding path: `useKeyboardHeight`'s `bottomPadding`, plus Tamagui `animation="quick"` on the input container. That would become a separate unit.
- **Android is unverified.**

## Open Questions

- None blocking.
