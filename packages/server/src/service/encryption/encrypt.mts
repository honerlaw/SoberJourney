import type { Context } from "../../context.mjs";
import { DEKIdentifier, getAsyncDEK } from "./getDEK.mjs";

export async function encrypt(
  ctx: Context,
  identifier: DEKIdentifier,
  data: string,
): Promise<string> {
  const dek = await getAsyncDEK(ctx, identifier);

  return await dek.encrypt(data);
}
