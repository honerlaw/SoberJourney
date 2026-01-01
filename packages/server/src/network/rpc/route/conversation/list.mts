import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";

export const list = procedure.query(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  const conversations = await ctx.database.conversation.list(ctx.auth.user.id);

  return {
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title || "New conversation",
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    })),
  };
});
