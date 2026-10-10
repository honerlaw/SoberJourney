# Proposal: chat-input-alignment

**Date**: 2026-10-10
**Status**: Draft

## Goal
On the Sponsor chat screen, the message input and the Send/Stop button line up: at one line both are exactly 44pt tall, so their tops, bottoms and centers coincide. The text and placeholder sit vertically centered in the input, with even, moderate inner padding. Auto-grow behaviour (44 → 140, then internal scroll; native via minHeight/maxHeight, web via measured height) is unchanged. Client-only; no server/API change.

## Why
User screenshot (iOS, SDK 57): the input looks misaligned with the send button and the text field "has weird padding". Measured from the screenshot (1320px @3x): the input is ~47pt tall vs the button's 44pt; the row is `alignItems="flex-end"`, so the bottoms align and the tops are offset by ~3pt. The placeholder sits visibly low, and there is ~16pt horizontal inset.
Cause: the TextArea takes Tamagui 1.141.5's `textAreaSizeVariant` at size `$true` (config v4): font 14 with lineHeight 24 (size+10), paddingVertical = space shifted -2 (13 by the web harness's 52px H1 = 13+24+13+2), paddingHorizontal = 16, radius 9. Button `$true` = height 44, radius 9. The one-line input = pad + 24 + pad + 2 border > 44. On native, Tamagui keeps `lineHeight` 24 for TextArea, and on iOS a lineHeight above the font's natural ~17pt (14pt SF) puts the extra leading above the glyphs, so the text sits low.

## Approach
In `ChatInput.tsx`, give the TextArea explicit typography/box props that override the size variant on all platforms, chosen to sum to exactly the button height at one line:
`fontSize 16, lineHeight 20, paddingVertical 11, paddingHorizontal 14` + 1px border ×2 → 1+11+20+11+1 = 44 = MIN_INPUT_HEIGHT = Button `$true` height. Keep `borderRadius` matching the button's (radius `$true` = 9, i.e. the variant's own value, left as is).
Keep the XStack `alignItems="flex-end"`: with equal one-line heights, flex-end and center coincide, so the controls read as centered. When the input grows to several lines, the button stays pinned to the last line (iMessage/ChatGPT convention) rather than floating at mid-height.
16px text also stops iOS Safari from zooming the page on focus (web). The 14 → 16 font change is visible and is called out in the PR.
Extend the existing native props harness pattern with a new unit-local check (`verify-chat-input-alignment.mjs`): the TextArea gets `{fontSize:16, lineHeight:20, paddingVertical:11, paddingHorizontal:14}` on iOS/Android/web, and pad*2 + lineHeight + 2 === 44 === MIN_INPUT_HEIGHT. Re-run the #56 web harness: it derives its one-line H1 from computed styles, so it must now report H1 = 44 and pass (a)-(e). Re-run the #57 native props harness (sizing props unchanged).

### Candidates
- **A (recommended)** — explicit typography/padding overrides on the styled TextArea; one row, button unchanged.
- **B** — `unstyled` TextArea, restyle from scratch (border, colors, focus style, radius, font). Rejected: re-implements theme/focus styling that the variant already gets right; more surface, same visual result.
- **C** — grow the button to the input's height (`size="$4.5"` 48) or set alignItems center without changing the input. Rejected: fixes only the outer edges; the low text and 14/24 typography inside the input remain ("weird padding" unaddressed); and center alone floats the button mid-input when multi-line.

### Scope
One unit, one PR: `ChatInput.tsx` (+ the unit's verification script and records). No other component uses this input.

## Success criteria
1. On iOS and Android, the ChatInput TextArea receives `fontSize 16, lineHeight 20, paddingVertical 11, paddingHorizontal 14` alongside the unchanged native sizing props, and the literals live in named constants whose sum (2×11 + 20 + 2×1 border) equals MIN_INPUT_HEIGHT (44). Checked by the unit's stubbed props check (`verify-chat-input-alignment-props.mjs`, esbuild + stubbed react-native/tamagui, switchable Platform.OS); it must fail against the pre-change ChatInput.
2. Web, real Tamagui in headless Chrome (the unit's `verify-chat-input-alignment.mjs`, built on the #56 harness's bundling): with an empty input, the textarea's and the Send button's bounding rects have equal height (44px) and their tops and bottoms coincide within 0.5px; the textarea's computed font-size/line-height/padding are 16/20/11/14px. This measures the button directly (not a hardcoded 44) and proves the overrides beat the size variant in real Tamagui. It must fail against the pre-change ChatInput (52px textarea vs 44px button).
3. The #56 web autogrow harness passes all checks against the new ChatInput (one-line H1 now 44).
4. The #57 native sizing harness still passes (minHeight 44, maxHeight 140, textAlignVertical top; no height/onContentSizeChange/scrollEnabled).
5. App tsc shows no new errors in ChatInput.tsx; eslint + prettier clean.
6. On-device iOS check by the user after merge (no simulator here): input and button the same height and aligned, placeholder vertically centered. The native cause in ## Why (variant lineHeight 24 putting leading above the glyphs) is a hypothesis this check gates. Named fallback if the text still sits low or the box overshoots 44 on device: drop to `lineHeight` ≈ the font's natural height / adjust `paddingVertical` on native only (and `includeFontPadding={false}` on Android).

## Open Questions
- None blocking. "Centered" is read as the two controls aligned at one line (equal heights make flex-end and center identical); `alignItems` stays flex-end so the button stays pinned to the last line when the input grows. Switching to center for multi-line is a one-prop change if the user prefers.
- Promote: the web one-line height "52px" in [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] and the #56 harness comment become stale (now 44); amend via a new entry linking back.
