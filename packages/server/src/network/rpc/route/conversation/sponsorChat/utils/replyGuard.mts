import { OFF_TOPIC_REPLY } from "./fallback.mjs";

// A Markdown code fence: a line starting (after optional indentation) with
// ``` or ~~~.
const CODE_FENCE = /^[ \t]*(?:```|~~~)/m;

// A whole fenced block, or an unclosed fence through to the end of the text.
const FENCED_BLOCK =
  /^[ \t]*(```|~~~)[^\n]*\n?[\s\S]*?(?:^[ \t]*\1[^\n]*$|(?![\s\S]))/gm;

// Signs that a reply carries crisis resources, which must never be discarded.
const CRISIS_MARKER =
  /\b(?:988|911|112|999)\b|1-800-662-4357|emergency number|crisis line|lifeline|hotline/i;

export function containsCodeFence(text: string): boolean {
  return CODE_FENCE.test(text);
}

/**
 * Deterministic backstop for the scope rules in the system prompt: the
 * sponsor never delivers or stores fenced code. Covers fenced code only;
 * unfenced off-topic content relies on the prompt.
 *
 * - No fence: the text is returned unchanged.
 * - Fence and a crisis-resource marker: the fenced blocks are stripped and
 *   the remaining prose kept, so crisis content is never discarded.
 * - Otherwise (or nothing left after stripping): OFF_TOPIC_REPLY.
 */
export function guardReply(text: string): string {
  if (!containsCodeFence(text)) {
    return text;
  }
  if (CRISIS_MARKER.test(text)) {
    const prose = text
      .replace(FENCED_BLOCK, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (prose) {
      return prose;
    }
  }
  return OFF_TOPIC_REPLY;
}
