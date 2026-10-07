import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { TRPCError } from "@trpc/server";
import type { Context } from "../../../../../context.mjs";
import { MessageRole } from "../../../../../util/database.mjs";
import { HISTORY_MAX_MESSAGES } from "./utils/buildHistory.mjs";
import { withConversationLock } from "../utils/conversationLock.mjs";
import {
  generateReply,
  loadCheckIns,
  type SponsorChatOutput,
} from "./runSponsorChat.mjs";

export type RetrySponsorChatInput = {
  conversationId: string;
  messageId: string;
};

export const NOT_RETRYABLE_MESSAGE = "This message can no longer be retried.";

/**
 * Generates the missing reply to a user message that an earlier, failed turn
 * already persisted (persist-before-generate), without saving the user
 * message again. Only the conversation's newest message can be retried, and
 * only while it is an unanswered USER row; anything else is a CONFLICT (the
 * turn was answered meanwhile, or the id is stale). Runs under the same
 * per-conversation lock as sponsorChat, and the check happens inside it, so a
 * retry queued behind an in-flight turn sees that turn's reply.
 */
export async function runRetrySponsorChat(
  ctx: Context,
  input: RetrySponsorChatInput,
  now: () => Date = () => new Date(),
): Promise<SponsorChatOutput> {
  const user = ctx.auth.user;
  if (!user) {
    throw new UnauthorizedError();
  }
  const userId = user.id;

  return withConversationLock(
    input.conversationId,
    async () => {
      const [page, journeys] = await Promise.all([
        ctx.database.conversation.getMessagesPage(
          input.conversationId,
          userId,
          { limit: HISTORY_MAX_MESSAGES + 1 },
        ),
        ctx.database.journey.list(userId),
      ]);

      if (!page) {
        throw new NotFoundError("Conversation not found.");
      }

      const newest = page.messages[page.messages.length - 1];
      if (
        !newest ||
        newest.id !== input.messageId ||
        newest.role !== MessageRole.USER
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: NOT_RETRYABLE_MESSAGE,
        });
      }

      const text = await ctx.service.encryption.decrypt(
        ctx,
        ctx.service.encryption.DEKIdentifier.CONVERSATION,
        newest.content,
      );

      const journeysWithCheckIns = await loadCheckIns(ctx, userId, journeys);

      const reply = await generateReply(ctx, {
        userId,
        storedTimeZone: user.timezone,
        conversationId: input.conversationId,
        conversationTitle: page.conversation.title,
        current: { id: newest.id, text },
        rows: page.messages,
        journeysWithCheckIns,
        now: now(),
      });

      return {
        response: reply.response,
        userMessageId: newest.id,
        modelMessageId: reply.modelMessageId,
      };
    },
    {
      onWaitTimeout: () =>
        ctx.logger.warn(
          {
            attributes: { conversationId: input.conversationId },
            tags: ["rpc", "conversation", "retrySponsorChat"],
          },
          "Timed out waiting for a previous turn; proceeding unserialized",
        ),
    },
  );
}
