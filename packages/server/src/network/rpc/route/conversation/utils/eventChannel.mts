/**
 * A single-consumer, in-memory event queue that bridges a producer running
 * elsewhere (e.g. a turn inside the conversation lock) to an async generator.
 *
 * - `push` queues an event (ignored once the channel has ended).
 * - `close` ends the channel after the queued events are consumed.
 * - `fail` ends it with an error, thrown after the queued events.
 * - An abort of `signal` ends iteration immediately, dropping queued events,
 *   and wakes a consumer waiting for the next event.
 *
 * Unbounded: the producer never waits for the consumer. Callers keep the
 * volume small (one chat reply's text).
 */
export type EventChannel<T> = AsyncIterable<T> & {
  push(value: T): void;
  close(): void;
  fail(error: unknown): void;
};

export function createEventChannel<T>(signal?: AbortSignal): EventChannel<T> {
  const queue: T[] = [];
  let ended = false;
  let aborted = false;
  let failure: { error: unknown } | null = null;
  let waiter: (() => void) | null = null;

  const wake = () => {
    const resolve = waiter;
    waiter = null;
    resolve?.();
  };

  const onAbort = () => {
    aborted = true;
    ended = true;
    queue.length = 0;
    wake();
  };
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }

  return {
    push(value) {
      if (ended) return;
      queue.push(value);
      wake();
    },
    close() {
      ended = true;
      wake();
    },
    fail(error) {
      if (ended) return;
      ended = true;
      failure = { error };
      wake();
    },
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          if (aborted) return;
          if (queue.length > 0) {
            yield queue.shift() as T;
            continue;
          }
          if (failure) throw failure.error;
          if (ended) return;
          await new Promise<void>((resolve) => {
            waiter = resolve;
          });
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
