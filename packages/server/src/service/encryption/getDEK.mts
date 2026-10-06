import type { Context } from "../../context.mjs";
import crypto from "crypto";
import Cryptr from "cryptr";
import { getConfig } from "../../util/config.mjs";

export enum DEKIdentifier {
  JOURNAL = "journal",
  CONVERSATION = "conversation",
}

/**
 * Request-scoped memo. Keyed by the ctx object itself, so everything cached
 * here (including the user's plaintext DEK) lives exactly as long as the
 * request's ctx and is garbage collected with it. Nothing is shared across
 * requests or users. Promises are cached so concurrent calls (e.g. a
 * `Promise.all` over list rows) collapse into a single lookup.
 */
const requestMemo = new WeakMap<object, Map<string, Promise<unknown>>>();

function memoize<T>(
  ctx: Context,
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  let memo = requestMemo.get(ctx);
  if (!memo) {
    memo = new Map();
    requestMemo.set(ctx, memo);
  }

  const existing = memo.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = factory();
  memo.set(key, promise);

  // never cache a failure, so a later call in the same request can retry
  promise.catch(() => {
    if (memo.get(key) === promise) {
      memo.delete(key);
    }
  });

  return promise;
}

/**
 * The KEK is constant for the process, so build its Cryptr once (per secret).
 * The async variant runs the 100k-iteration PBKDF2 on the libuv threadpool
 * instead of blocking the event loop; its ciphertext format is byte-identical
 * to the sync `Cryptr` used previously.
 */
let kekCache: {
  secret: string;
  kek: InstanceType<typeof Cryptr.CryptrAsync>;
} | null = null;

async function getKEK() {
  const secret = await getConfig("KEY_ENCRYPTION_KEY");
  if (kekCache === null || kekCache.secret !== secret) {
    kekCache = { secret, kek: new Cryptr.CryptrAsync(secret) };
  }
  return kekCache.kek;
}

async function findUserKey(ctx: Context, userId: string) {
  return ctx.database.client.userKey.findUnique({
    where: { userId },
    select: { key: true },
  });
}

/**
 * Resolve the user's plaintext DEK: read the stored (KEK-wrapped) key first and
 * only generate + insert one when it does not exist yet.
 */
function getUserDEK(ctx: Context, userId: string): Promise<string> {
  return memoize(ctx, `user:${userId}`, async () => {
    const kek = await getKEK();

    let stored = await findUserKey(ctx, userId);
    if (!stored) {
      const encryptedDek = await kek.encrypt(
        crypto.randomBytes(32).toString("hex"),
      );
      // create-or-return-existing; returns null on error (e.g. a P2002 unique
      // violation when another request created the key concurrently)
      stored = await ctx.database.user.key.upsert(userId, encryptedDek);
      if (!stored) {
        stored = await findUserKey(ctx, userId);
      }
      if (!stored) {
        throw new Error("Failed to create or read user key");
      }
    }

    return kek.decrypt(stored.key);
  });
}

/**
 * The Cryptr module does the heavy lifting of the actual encryption / decryption.
 *
 * This means that mainly we need to store a user level DEK and then create a new
 * data specific DEK from it to use as the keys for the Cryptr module.
 *
 * The result is memoized on the request ctx, so a request performs at most one
 * key lookup per user (shared across identifiers) and one Cryptr per identifier,
 * no matter how many rows it encrypts or decrypts.
 */
export async function getDEK(
  ctx: Context,
  identifier: DEKIdentifier,
): Promise<Cryptr> {
  const userId = ctx.auth.user?.id;
  if (!userId) {
    throw new Error("User not found");
  }

  return memoize(ctx, `dek:${userId}:${identifier}`, async () => {
    const userDek = await getUserDEK(ctx, userId);

    // tack on the identifier to make it specific to the data type
    return new Cryptr(`${userDek}:${identifier}`, {
      // lower for the actual DEK so bulk operations are faster
      // otherwise the default puts it at ~40ms per opt
      pbkdf2Iterations: 1000,
    });
  });
}
