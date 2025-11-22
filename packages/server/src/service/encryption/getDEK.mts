import type { Context } from "../../context.mjs";
import crypto from "crypto";
import Cryptr from "cryptr";
import { getConfig } from "../../util/config.mjs";

export enum DEKIdentifier {
  TRANSACTIONS = "transactions",
}

/**
 * The Cryptr module does the heavy lifting of the actual encryption / decryption.
 *
 * This means that mainly we need to store a user level DEK and then create a new
 * data specific DEK from it to use as the keys for the Cryptr module.
 *
 * By creating this separatly, we can also do bulk encryption / decryption on similar
 * data (e.g. transactions), without having to regenerate and hit the database each time.
 */
export async function getDEK(
  ctx: Context,
  identifier: DEKIdentifier,
): Promise<Cryptr> {
  if (!ctx.auth.user?.id) {
    throw new Error("User not found");
  }

  const kek = new Cryptr(await getConfig("KEY_ENCRYPTION_KEY"));

  // generate a tmp DEK to upsert if one does not already exist
  const tmpDek = crypto.randomBytes(32).toString("hex");
  const encryptedDek = kek.encrypt(tmpDek);
  const actualKey = await ctx.database.user.key.upsert(
    ctx.auth.user.id,
    encryptedDek,
  );
  if (!actualKey) {
    throw new Error("Failed to upsert user key");
  }

  // get the actual DEK for the user, tack on the identifer
  // to make it specific to the data type we are encryption
  const decryptedDek = kek.decrypt(actualKey.key);
  return new Cryptr(`${decryptedDek}:${identifier}`, {
    // lower for the actual DEK so bulk operations are faster
    // otherwise the default puts it at ~40ms per opt
    pbkdf2Iterations: 1000,
  });
}
