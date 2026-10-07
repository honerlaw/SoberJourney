import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import type { Context } from "../../../../../context.mjs";
import { type ChatResult } from "../../../../../datasource/gemini/chat.mjs";
import { withConversationLock } from "../utils/conversationLock.mjs";
import { createEventChannel } from "../utils/eventChannel.mjs";
import {
  buildGeneration,
  finishReply,
  MAX_OUTPUT_TOKENS,
  startTurn,
  toRpcError,
  type SponsorChatInput,
} from "./runSponsorChat.mjs";

/**
 * Events of `conversation.streamSponsorChat`, in order:
 * `saved` once the user's message is persisted, `delta` per chunk of model
 * text, `done` once the reply is persisted. `done.response` is the
 * authoritative reply text: it replaces the concatenated deltas (it differs
 * from them when a safety block turned the reply into a fallback message).
 */
export type SponsorChatStreamEvent =
  | { type: "saved"; userMessageId: string }
  | { type: "delta"; text: string }
  | {
      type: "done";
      response: string;
      userMessageId: string;
      modelMessageId: string;
    };

/**
 * One sponsor-chat turn, streamed. Same pipeline and product rules as
 * sponsorChat (persist the user message first, keep it on failure, persist
 * the reply only when complete, fallback reply for blocked responses, never
 * store a truncated reply), serialized by the same per-conversation lock.
 *
 * The turn runs inside the lock and pushes events into a channel this
 * generator drains, so the lock is held for the whole turn however the
 * consumer behaves.
 *
 * Abort (`signal`, i.e. the client went away, or this generator being
 * returned early): if the user message is not persisted yet the turn does
 * nothing; during generation the Gemini call is cancelled and nothing more is
 * persisted (the saved user message stays unanswered and can be retried); a
 * reply whose generation already finished is still persisted.
 */
export async function* runStreamSponsorChat(
  ctx: Context,
  input: SponsorChatInput,
  signal?: AbortSignal,
  now: () => Date = () => new Date(),
): AsyncGenerator<SponsorChatStreamEvent, void, undefined> {
  const user = ctx.auth.user;
  if (!user) {
    throw new UnauthorizedError();
  }

  const abort = new AbortController();
  const onAbort = () => abort.abort(signal?.reason);
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }

  const channel = createEventChannel<SponsorChatStreamEvent>(abort.signal);

  const turn = withConversationLock(
    input.conversationId,
    async () => {
      // Gave up while queued behind another turn: do nothing.
      if (abort.signal.aborted) {
        return;
      }

      const started = await startTurn(
        ctx,
        user.id,
        user.timezone,
        input,
        now(),
        abort.signal,
      );
      channel.push({ type: "saved", userMessageId: started.userMessageId });

      const generation = await buildGeneration(ctx, started.params);
      abort.signal.throwIfAborted();

      let result: ChatResult;
      try {
        const stream = ctx.datasource.gemini.chatStream(generation.history, {
          systemInstruction: generation.systemInstruction,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          abortSignal: abort.signal,
        });
        while (true) {
          const next = await stream.next();
          if (next.done) {
            result = next.value;
            break;
          }
          channel.push({ type: "delta", text: next.value });
        }
      } catch (error) {
        if (abort.signal.aborted) {
          throw error;
        }
        throw toRpcError(error);
      }

      // Not checked for abort: a finished generation is always persisted.
      const reply = await finishReply(ctx, started.params, result);
      channel.push({
        type: "done",
        response: reply.response,
        userMessageId: started.userMessageId,
        modelMessageId: reply.modelMessageId,
      });
    },
    {
      onWaitTimeout: () =>
        ctx.logger.warn(
          {
            attributes: { conversationId: input.conversationId },
            tags: ["rpc", "conversation", "streamSponsorChat"],
          },
          "Timed out waiting for a previous turn; proceeding unserialized",
        ),
    },
  );

  // Always handled, so a turn failing after the consumer left is never an
  // unhandled rejection.
  turn.then(
    () => channel.close(),
    (error: unknown) => {
      if (abort.signal.aborted) {
        channel.close();
        return;
      }
      channel.fail(error);
    },
  );

  try {
    yield* channel;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    // Stops generation if the consumer left early; a no-op once the turn has
    // finished.
    abort.abort();
  }
}
