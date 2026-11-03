import type { Context } from "../../context.mjs";
import { DEKIdentifier, getAsyncDEK } from "./getDEK.mjs";
import { reserveDecrypts } from "./decryptBudget.mjs";

export async function decrypt(
  ctx: Context,
  identifier: DEKIdentifier,
  data: string,
): Promise<string> {
  reserveDecrypts(ctx, 1);

  const dek = await getAsyncDEK(ctx, identifier);

  return await dek.decrypt(data);
}

/**
 * Decrypts a list of values, reserving the whole count from the user's
 * decrypt budget first, so a rejected list decrypts nothing. Order is kept.
 */
export async function decryptMany(
  ctx: Context,
  identifier: DEKIdentifier,
  values: readonly string[],
): Promise<string[]> {
  if (values.length === 0) {
    return [];
  }

  reserveDecrypts(ctx, values.length);

  const dek = await getAsyncDEK(ctx, identifier);

  return await Promise.all(values.map((value) => dek.decrypt(value)));
}
