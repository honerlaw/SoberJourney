import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeLockCount, withConversationLock } from "../conversationLock.mjs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("withConversationLock", () => {
  it("serializes work on the same conversation", async () => {
    const events: string[] = [];
    const task = (name: string, ms: number) => async () => {
      events.push(`${name}:start`);
      await sleep(ms);
      events.push(`${name}:end`);
      return name;
    };
    const results = await Promise.all([
      withConversationLock("c-serial", task("a", 20)),
      withConversationLock("c-serial", task("b", 5)),
      withConversationLock("c-serial", task("c", 1)),
    ]);
    assert.deepEqual(results, ["a", "b", "c"]);
    assert.deepEqual(events, [
      "a:start",
      "a:end",
      "b:start",
      "b:end",
      "c:start",
      "c:end",
    ]);
  });

  it("does not serialize different conversations", async () => {
    const gate = deferred();
    const first = withConversationLock("c-x", () =>
      gate.promise.then(() => "x"),
    );
    const second = await withConversationLock("c-y", async () => "y");
    assert.equal(second, "y");
    gate.resolve();
    assert.equal(await first, "x");
  });

  it("releases the lock when the work throws", async () => {
    await assert.rejects(
      withConversationLock("c-throw", async () => {
        throw new Error("boom");
      }),
      /boom/,
    );
    const value = await withConversationLock("c-throw", async () => "after");
    assert.equal(value, "after");
    await sleep(0);
    assert.equal(activeLockCount(), 0);
  });

  it("proceeds after the bounded wait, without letting newer callers skip the in-flight turn", async () => {
    const events: string[] = [];
    const gate = deferred();
    let timeouts = 0;

    const first = withConversationLock("c-wait", async () => {
      events.push("first:start");
      await gate.promise;
      events.push("first:end");
    });
    const second = withConversationLock(
      "c-wait",
      async () => {
        events.push("second:run");
      },
      { waitMs: 10, onWaitTimeout: () => timeouts++ },
    );
    await second;
    assert.equal(timeouts, 1);
    assert.deepEqual(events, ["first:start", "second:run"]);

    // A third caller (long wait) must still queue behind the in-flight first turn.
    const third = withConversationLock("c-wait", async () => {
      events.push("third:run");
    });
    await sleep(20);
    assert.deepEqual(events, ["first:start", "second:run"]);
    gate.resolve();
    await Promise.all([first, third]);
    assert.deepEqual(events, [
      "first:start",
      "second:run",
      "first:end",
      "third:run",
    ]);
    await sleep(0);
    assert.equal(activeLockCount(), 0);
  });
});
