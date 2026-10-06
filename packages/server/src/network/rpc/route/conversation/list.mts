import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { type ConversationModel } from "../../../../util/database.mjs";
import {
  DEFAULT_PAGE_SIZE,
  paginationFields,
  wantsPagination,
} from "./utils/pagination.mjs";

const MAX_PAGE_SIZE = 100;

// The whole input is optional: released apps call `list` with no input.
export const listConversationsInput = z
  .object(paginationFields(MAX_PAGE_SIZE))
  .optional();

export function toListItem(conversation: ConversationModel) {
  return {
    id: conversation.id,
    title: conversation.title || "New conversation",
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export const list = procedure
  .input(listConversationsInput)
  .query(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // No pagination requested: today's full list.
    if (!input || !wantsPagination(input)) {
      const conversations = await ctx.database.conversation.list(
        ctx.auth.user.id,
      );
      return {
        conversations: conversations.map(toListItem),
        nextCursor: null as string | null,
      };
    }

    const page = await ctx.database.conversation.listPage(ctx.auth.user.id, {
      cursor: input.cursor,
      limit: input.limit ?? DEFAULT_PAGE_SIZE,
    });

    if (!page) {
      throw new InternalServerError("Failed to list conversations.");
    }

    return {
      conversations: page.conversations.map(toListItem),
      nextCursor: page.nextCursor,
    };
  });
