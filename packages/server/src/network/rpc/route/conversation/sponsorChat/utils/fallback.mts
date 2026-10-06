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
