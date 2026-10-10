# Replan log: chat-input-web-autogrow

## 2026-10-10 — Web one-line height is 52px, not 44: success criteria (a), (b) and (d) restated relative to the measured one-line height

**Original plan**: Criteria 2(a) and 2(d) required the web input to sit at exactly 44px on mount and after clearing, and 2(b) required 3 lines to measure in (44, 140). This assumed `MIN_INPUT_HEIGHT` (44) equals the web one-line height.
**What changed**: The real-browser harness (real ChatInput, RNW 0.21.2, Tamagui 1.141.5 default config) measured the textarea's computed style as border-box with 13px top and bottom padding, a 24px line height and a 1px border. One line therefore needs 13+13+24+2 = 52px. A 44px box leaves a 16px content box, which clips the 24px line. The implementation itself is validated:
- mount: 64 frames, all 52px, zero changes (the pre-fix code was 140px from the first painted frame);
- 3 lines: 100px, stable;
- past the cap: 140px with scrollTop kept;
- halved width: 76 → 140, stable;
- cleared: 52px.

The 44 in the criteria came from the native formula (text height + 20). It is native-tuned, and on web at the default size it is inert: it only guards degenerate measurements. A smaller Tamagui size variant could have a one-line height below 44, in which case the floor would pad it up to 44; that is acceptable and noted. No padding or visual change is made. Nothing else on the Sponsor page consumes the 44 value. The divergence panel voted 3/3 accept with fixes, and its fixes are incorporated here. `grep MIN_INPUT_HEIGHT packages/app/src` returns only `ChatInput.tsx`.
**New plan**: Approach and code unchanged; the clamp floor stays 44. Success criteria 2(a), 2(b) and 2(d) are restated relative to the measured one-line height (scrollHeight + border, with 52px observed under the default Tamagui size):
- (a) After mount, every sampled frame for ~1s has the same height H1, and H1 ≥ 44.
- (b) After typing 3 lines, the height is greater than H1 and less than 140, and is unchanged over the next 30 frames.
- (d) After clearing the text, the height returns to exactly H1 over 30 frames.

(c) and (e) are unchanged. (a) also asserts that H1 equals max(44, what one line needs), computed from the computed style as vertical padding + line height + borders. A merely stable height is not enough, because the pre-fix ratchet completes before first paint, so the pre-fix height is stable too, at 140. (a) also asserts no clipping at H1 (`scrollHeight <= clientHeight`), which is the real invariant behind the old 44. H1 is captured from (a) in the same run and reused in (b) and (d). 52 is an observation under the default size; the harness does not assert it. "scrollHeight + border" is the Approach's measurement formula. (f) remains a change check: the pre-fix ChatInput fails the restated (a), because its first painted frame is already 140px, the ratchet having finished before first paint, and it never returns to that height after clearing. It is run with `--expect-ratchet`. The harness asserts these relational conditions and prints the observed values.
