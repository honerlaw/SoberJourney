/**
 * Reply used when Gemini blocks a prompt or response for safety reasons.
 * Returned through the normal success shape and persisted as the MODEL turn.
 *
 * buildHistory recognises a blocked turn by exact equality with this constant
 * (there is no schema column for it), so changing the wording means older
 * blocked turns are no longer excluded from history.
 *
 * Deliberately does not add crisis-resource language: whether to surface
 * hotlines is an open product decision (see the system prompt).
 */
export const SAFETY_FALLBACK_REPLY =
  "I'm here with you, and I want to keep supporting you. I wasn't able to respond to that last message directly. Could you tell me a little more about what's going on and how you're feeling right now?";
