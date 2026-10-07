import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEventChannel } from "../eventChannel.mjs";

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("createEventChannel", () => {
  it("delivers queued and later events in order, then ends on close", async () => {
    const channel = createEventChannel<number>();
    channel.push(1);
    const done = collect(channel);
    channel.push(2);
    await new Promise((r) => setTimeout(r, 0));
    channel.push(3);
    channel.close();
    channel.push(4); // ignored after close
    assert.deepEqual(await done, [1, 2, 3]);
  });

  it("throws a failure after the queued events", async () => {
    const channel = createEventChannel<string>();
    channel.push("a");
    channel.fail(new Error("boom"));
    channel.fail(new Error("ignored"));
    const seen: string[] = [];
    await assert.rejects(
      (async () => {
        for await (const value of channel) seen.push(value);
      })(),
      /boom/,
    );
    assert.deepEqual(seen, ["a"]);
  });

  it("ends immediately on abort, waking a waiting consumer and dropping queued events", async () => {
    const abort = new AbortController();
    const channel = createEventChannel<number>(abort.signal);
    const iterator = channel[Symbol.asyncIterator]();
    const waiting = iterator.next();
    abort.abort();
    assert.deepEqual(await waiting, { done: true, value: undefined });

    const abort2 = new AbortController();
    const channel2 = createEventChannel<number>(abort2.signal);
    channel2.push(1);
    abort2.abort();
    channel2.fail(new Error("ignored after abort"));
    assert.deepEqual(await collect(channel2), []);
  });

  it("starts ended when the signal is already aborted", async () => {
    const channel = createEventChannel<number>(AbortSignal.abort());
    channel.push(1);
    assert.deepEqual(await collect(channel), []);
  });
});
