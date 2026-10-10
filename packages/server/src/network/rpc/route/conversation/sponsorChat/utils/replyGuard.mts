import { OFF_TOPIC_REPLY } from "./fallback.mjs";

// A Markdown code fence: a line starting (after optional indentation) with
// ``` or ~~~.
const CODE_FENCE = /^[ \t]*(?:```|~~~)/m;

// An opening fence (with an optional info string) or a bare closing fence.
const FENCE_LINE = /^[ \t]*(`{3,}|~{3,})(.*)$/;

// Signs that a reply carries crisis resources, which must never be discarded.
const CRISIS_MARKER =
  /\b(?:988|911|112|999)\b|1-800-662-4357|emergency number|crisis line|lifeline|hotline/i;

export function containsCodeFence(text: string): boolean {
  return CODE_FENCE.test(text);
}

/**
 * Removes fenced code blocks, keeping the prose around them. A block closes
 * on a bare fence of the same character at least as long as the opening one
 * (CommonMark); an unclosed block runs to the end of the text.
 */
function stripFencedBlocks(text: string): string {
  const prose: string[] = [];
  let open: { char: string; length: number } | null = null;

  for (const line of text.split("\n")) {
    const fence = FENCE_LINE.exec(line);
    if (!open) {
      if (fence) {
        open = { char: fence[1]![0]!, length: fence[1]!.length };
      } else {
        prose.push(line);
      }
      continue;
    }
    if (
      fence &&
      fence[1]![0] === open.char &&
      fence[1]!.length >= open.length &&
      fence[2]!.trim() === ""
    ) {
      open = null;
    }
  }

  return prose
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Deterministic backstop for the scope rules in the system prompt: the
 * sponsor never delivers or stores fenced code. Covers fenced code only;
 * unfenced off-topic content relies on the prompt.
 *
 * - No fence: the text is returned unchanged.
 * - Fence, and the prose outside the code carries a crisis-resource marker:
 *   the fenced blocks are stripped and the prose kept, so crisis content is
 *   never discarded.
 * - Otherwise: OFF_TOPIC_REPLY.
 */
export function guardReply(text: string): string {
  if (!containsCodeFence(text)) {
    return text;
  }
  const prose = stripFencedBlocks(text);
  return CRISIS_MARKER.test(prose) ? prose : OFF_TOPIC_REPLY;
}
