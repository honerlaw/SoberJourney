# The chat input pins its own typography so one line equals the 44px button

**Date**: 2026-10-10
**Type**: reference
**Theme**: sponsor-chat
**Summary**: Tamagui's TextArea size variant makes one line 52px (14/24 type, 13/16 padding); ChatInput overrides it to 16/20/11/14 = 44.
**Context**: .minerva/work/2026-10-10-chat-input-alignment (see git history if the worktree has been cleaned up)

## Context
The Sponsor chat input looked misaligned with its Send button on iOS. At size `$true` (config v4), Tamagui 1.141.5's `textAreaSizeVariant` gives the TextArea a 14px font, a 24px line height (font size + 10), 13px vertical padding and 16px horizontal padding. One line is therefore 13 + 24 + 13 + 2 border = 52px on web; the screenshot showed about 47pt on iOS. A Button at `$true` is 44px. Because the row is `alignItems="flex-end"`, the bottoms lined up and the tops did not.

## Finding
`ChatInput.tsx` passes these explicit props to the TextArea on every platform:

| Constant | Value |
|---|---|
| `INPUT_FONT_SIZE` | 16 |
| `INPUT_LINE_HEIGHT` | 20 |
| `INPUT_PADDING_VERTICAL` | 11 |
| `INPUT_PADDING_HORIZONTAL` | 14 |

One line is 2 × 11 + 20 + 2 × 1 border = 44 = `MIN_INPUT_HEIGHT`, which matches the button. Direct props override the size variant's values. Real Tamagui in headless Chrome confirms this: the computed style is 16/20/11/14px, the textarea and the Send button are both 44px, and their tops and bottoms coincide.

The native spread also passes `includeFontPadding: false`. Android applies `lineHeight` only as a span on typed text, so without this the empty placeholder line could exceed 20dp. The Stop button is the same unsized `Button`, so it is 44px too.

## Implications
- The web one-line height is now 44px, not the 52px quoted in [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] and in the #56 harness comment. The constraint itself still holds: web measures its height and never assumes one.
- If the button size or `MIN_INPUT_HEIGHT` changes, retune the four constants so they still sum to it. `.minerva/work/2026-10-10-chat-input-alignment/verify-chat-input-alignment.mjs` measures the real button against the textarea, and the props check asserts the native sum.
- Native layout is not covered by any harness. The iOS and Android appearance is left to an on-device check after merge. If text sits low or the box overshoots 44, the fallback is to tune the native `lineHeight` or `paddingVertical`.
- Under Dynamic Type, one line grows past 44. The flex-end row keeps the bottoms aligned, which is acceptable.

## Related
- [[2026-10-10-constraint-native-textinput-autosize-not-contentsize]] — native sizing props unchanged (minHeight/maxHeight auto-size)
- [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] — its "52px" one-line figure is now 44px
