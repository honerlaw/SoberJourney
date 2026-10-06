import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHistory, type HistoryMessage } from "../buildHistory.mjs";
import { SAFETY_FALLBACK_REPLY } from "../fallback.mjs";

const u = (text: string): HistoryMessage => ({ role: "user", text });
const m = (text: string): HistoryMessage => ({ role: "model", text });

const flat = (contents: ReturnType<typeof buildHistory>) =>
  contents.map((c) => `${c.role}:${c.parts?.[0]?.text}`);

describe("buildHistory", () => {
  it("passes a normal alternating conversation through", () => {
    assert.deepEqual(flat(buildHistory([u("a"), m("b"), u("c")])), [
      "user:a",
      "model:b",
      "user:c",
    ]);
  });

  it("merges consecutive same-role turns, including a trailing unanswered user row", () => {
    // u1 failed (orphan), user retried with u2
    assert.deepEqual(flat(buildHistory([u("a"), m("b"), u("u1"), u("u2")])), [
      "user:a",
      "model:b",
      "user:u1\n\nu2",
    ]);
    assert.deepEqual(flat(buildHistory([u("a"), m("b"), m("c"), u("d")])), [
      "user:a",
      "model:b\n\nc",
      "user:d",
    ]);
  });

  it("drops leading model turns so history starts with the user", () => {
    assert.deepEqual(flat(buildHistory([m("x"), u("a"), m("b"), u("c")])), [
      "user:a",
      "model:b",
      "user:c",
    ]);
  });

  it("limits by message count, always keeping the current message", () => {
    const messages = [u("1"), m("2"), u("3"), m("4"), u("5")];
    assert.deepEqual(flat(buildHistory(messages, { maxMessages: 3 })), [
      "user:3",
      "model:4",
      "user:5",
    ]);
    // a window boundary that lands on a model row drops it
    assert.deepEqual(flat(buildHistory(messages, { maxMessages: 2 })), [
      "user:5",
    ]);
  });

  it("limits by character budget but never drops the current message", () => {
    const big = "x".repeat(100);
    const history = buildHistory([u(big), m(big), u("y".repeat(500))], {
      maxChars: 150,
    });
    assert.deepEqual(flat(history), [`user:${"y".repeat(500)}`]);
    const history2 = buildHistory([u("aa"), m("bb"), u(big)], { maxChars: 4 });
    assert.deepEqual(flat(history2), ["user:aa", "model:bb", `user:${big}`]);
  });

  it("handles a window that cuts through a run of user rows", () => {
    const messages = [u("a"), m("b"), u("o1"), u("o2"), u("cur")];
    assert.deepEqual(flat(buildHistory(messages, { maxMessages: 2 })), [
      "user:o2\n\ncur",
    ]);
  });

  it("excludes blocked turns (user rows answered by the safety fallback)", () => {
    const messages = [
      u("hello"),
      m("hi"),
      u("orphan"),
      u("blocked prompt"),
      m(SAFETY_FALLBACK_REPLY),
      u("next"),
    ];
    assert.deepEqual(flat(buildHistory(messages)), [
      "user:hello",
      "model:hi",
      "user:next",
    ]);
  });

  it("returns only the current message when everything before was blocked", () => {
    assert.deepEqual(
      flat(buildHistory([u("bad"), m(SAFETY_FALLBACK_REPLY), u("ok")])),
      ["user:ok"],
    );
  });
});
