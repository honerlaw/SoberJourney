import { UnauthorizedError } from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";

export const list = procedure.query(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  const entries = await ctx.database.journal.list(ctx.auth.user.id);

  // one budget reservation for the whole list, before any decryption
  const contents = await ctx.service.encryption.decryptMany(
    ctx,
    ctx.service.encryption.DEKIdentifier.JOURNAL,
    entries.map((entry) => entry.content),
  );
  const decryptedEntries = entries.map((entry, index) => ({
    id: entry.id,
    createdAt: entry.createdAt,
    preview: contents[index]!.slice(0, 150),
  }));

  return {
    entries: decryptedEntries,
  };
});
