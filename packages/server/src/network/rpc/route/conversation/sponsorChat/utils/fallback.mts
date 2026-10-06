/**
 * Reply used when Gemini blocks a prompt or response for safety reasons.
 * Returned through the normal success shape and persisted as the MODEL turn.
 *
 * buildHistory recognises a blocked turn by exact equality with this constant
 * (there is no schema column for it), so changing the wording means older
 * blocked turns are no longer excluded from history.
 *
 * A safety block often follows a message about self-harm or danger, so the
 * reply mentions crisis resources conditionally ("if you're ...") without
 * assuming a crisis, matching the system prompt's crisis-resources guidance.
 */
export const SAFETY_FALLBACK_REPLY =
  "I'm here with you, but I couldn't respond to that last message directly. Can you tell me a bit more about how you're feeling right now? If you're thinking about hurting yourself or you're in danger, please reach out now: in the US, call or text 988 or call 911; elsewhere, your local emergency number. I'm still here with you.";

/**
 * Reply for blocks that are not about harmful content (recitation, personal
 * data, blocklist, unspecified): no crisis wording, so a craving or a request
 * for a prayer's text never gets a hotline answer.
 */
export const BLOCKED_FALLBACK_REPLY =
  "I'm sorry, I couldn't respond to that last message. Could you try saying it a different way? I'm here to keep talking with you.";

const HARMFUL_CONTENT_REASONS: ReadonlySet<string> = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
]);

/**
 * Picks the fallback for a blocked response. Only harmful-content blocks get
 * the reply with the conditional crisis line.
 */
export function fallbackReplyFor(reason: string): string {
  return HARMFUL_CONTENT_REASONS.has(reason)
    ? SAFETY_FALLBACK_REPLY
    : BLOCKED_FALLBACK_REPLY;
}

/**
 * Every fallback text; buildHistory drops turns answered by any of them.
 */
export const FALLBACK_REPLIES: ReadonlySet<string> = new Set([
  SAFETY_FALLBACK_REPLY,
  BLOCKED_FALLBACK_REPLY,
]);
