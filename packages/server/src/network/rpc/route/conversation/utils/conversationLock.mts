/**
 * Best-effort, in-process serialization of work per conversation.
 *
 * A second sponsor-chat turn for the same conversation waits for the first
 * turn to finish so its history includes the first reply. Waiting is bounded:
 * after `waitMs` the waiter proceeds unserialized (degrading to merged
 * history, never an error), so a queued request stays under proxy timeouts.
 *
 * This only serializes within one server process. If the server is scaled to
 * more than one instance, turns routed to different instances can interleave;
 * history building tolerates that (same-role turns are merged).
 */

export const LOCK_WAIT_MS = 20_000;

// The tail of each conversation's queue. A new caller chains behind it.
const tails = new Map<string, Promise<void>>();

export type LockOptions = {
  waitMs?: number;
  onWaitTimeout?: () => void;
};

export async function withConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const waitMs = options.waitMs ?? LOCK_WAIT_MS;
  const previous = tails.get(conversationId) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  // Later callers wait for everything queued so far, including a turn this
  // caller may have stopped waiting for, so a timed-out waiter never lets a
  // newer caller skip ahead of a still-running turn.
  const tail = previous.then(() => current);
  tails.set(conversationId, tail);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = await Promise.race([
    previous.then(() => false),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), waitMs);
    }),
  ]);
  clearTimeout(timer);

  if (timedOut) {
    options.onWaitTimeout?.();
  }

  try {
    return await fn();
  } finally {
    release();
    // Drop the entry only once the whole chain has settled and nobody newer
    // has queued behind it.
    void tail.then(() => {
      if (tails.get(conversationId) === tail) {
        tails.delete(conversationId);
      }
    });
  }
}

/**
 * Number of conversations with queued or running work. Exported for tests.
 */
export function activeLockCount(): number {
  return tails.size;
}
