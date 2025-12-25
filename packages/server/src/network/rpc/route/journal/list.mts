import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";

export const list = procedure.query(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  const entries = await ctx.database.journal.list(ctx.auth.user.id);

  const decryptedEntries = await Promise.all(
    entries.map(async (entry) => {
      const decryptedContent = await ctx.service.encryption.decrypt(
        ctx,
        ctx.service.encryption.DEKIdentifier.JOURNAL,
        entry.content,
      );
      return {
        id: entry.id,
        createdAt: entry.createdAt,
        preview: decryptedContent.slice(0, 150),
      };
    }),
  );

  return {
    entries: decryptedEntries,
  };
});
