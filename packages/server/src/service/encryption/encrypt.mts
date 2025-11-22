import type { Context } from "../../context.mjs";
import { DEKIdentifier, getDEK } from "./getDEK.mjs";

export async function encrypt(
  ctx: Context,
  identifier: DEKIdentifier,
  data: string,
): Promise<string> {
  const dek = await getDEK(ctx, identifier);

  return dek.encrypt(data);
}
