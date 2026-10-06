import {
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { decryptMessages } from "./utils/decryptMessages.mjs";
import {
  DEFAULT_PAGE_SIZE,
  paginationFields,
  wantsPagination,
} from "./utils/pagination.mjs";

const MAX_PAGE_SIZE = 200;

export const getConversationInput = z.object({
  conversationId: z.uuid(),
  // Optional, additive: omitted => all messages (released apps).
  ...paginationFields(MAX_PAGE_SIZE),
});

export const get = procedure
  .input(getConversationInput)
  .query(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    if (!wantsPagination(input)) {
      const conversation = await ctx.database.conversation.get(
        input.conversationId,
        ctx.auth.user.id,
      );

      if (!conversation) {
        throw new NotFoundError("Conversation not found.");
      }

      return {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: await decryptMessages(ctx, conversation.messages),
          nextCursor: null as string | null,
        },
      };
    }

    const page = await ctx.database.conversation.getMessagesPage(
      input.conversationId,
      ctx.auth.user.id,
      {
        cursor: input.cursor,
        limit: input.limit ?? DEFAULT_PAGE_SIZE,
      },
    );

    if (!page) {
      throw new NotFoundError("Conversation not found.");
    }

    return {
      conversation: {
        id: page.conversation.id,
        title: page.conversation.title,
        createdAt: page.conversation.createdAt,
        updatedAt: page.conversation.updatedAt,
        messages: await decryptMessages(ctx, page.messages),
        nextCursor: page.nextCursor,
      },
    };
  });
