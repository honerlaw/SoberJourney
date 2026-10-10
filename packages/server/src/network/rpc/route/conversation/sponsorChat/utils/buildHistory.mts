import { type ChatMessage } from "../../../../../../datasource/openrouter/chat.mjs";
import { FALLBACK_REPLIES } from "./fallback.mjs";

// The DB only loads this many recent messages for a turn.
export const HISTORY_MAX_MESSAGES = 40;
// Roughly 12k tokens of prior conversation. The newest (current) message is
// always included on top of this budget.
export const HISTORY_MAX_CHARS = 48_000;

export type HistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

export type HistoryOptions = {
  maxMessages?: number;
  maxChars?: number;
};

/**
 * Builds the model `messages` for a turn from chronological messages whose
 * last element is the user's current message.
 *
 * - Blocked turns (user message(s) answered by a fallback reply) are
 *   dropped, so a blocked prompt is not re-sent on every later turn.
 * - Keeps the newest messages within a message-count and character budget;
 *   the current message is always kept.
 * - Starts with a user turn and merges consecutive same-role turns (rows like
 *   an unanswered user message after a failed turn already exist).
 */
export function buildHistory(
  messages: HistoryMessage[],
  options: HistoryOptions = {},
): ChatMessage[] {
  const maxMessages = options.maxMessages ?? HISTORY_MAX_MESSAGES;
  const maxChars = options.maxChars ?? HISTORY_MAX_CHARS;

  // 1. Drop blocked turns.
  const kept: HistoryMessage[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && FALLBACK_REPLIES.has(message.text)) {
      while (kept.length > 0 && kept[kept.length - 1]!.role === "user") {
        kept.pop();
      }
      continue;
    }
    kept.push(message);
  }

  if (kept.length === 0) {
    return [];
  }

  // 2. Window: newest first, always keeping the current (last) message.
  const windowed: HistoryMessage[] = [kept[kept.length - 1]!];
  let chars = 0;
  for (let i = kept.length - 2; i >= 0; i--) {
    if (windowed.length >= maxMessages) break;
    const message = kept[i]!;
    if (chars + message.text.length > maxChars) break;
    chars += message.text.length;
    windowed.unshift(message);
  }

  // 3. History must start with a user turn.
  while (windowed.length > 0 && windowed[0]!.role !== "user") {
    windowed.shift();
  }

  // 4. Merge consecutive same-role turns.
  const merged: ChatMessage[] = [];
  for (const message of windowed) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${message.text}`;
    } else {
      merged.push({ role: message.role, content: message.text });
    }
  }

  return merged;
}
