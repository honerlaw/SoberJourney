import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { containsCodeFence, guardReply } from "../replyGuard.mjs";
import { OFF_TOPIC_REPLY } from "../fallback.mjs";

describe("containsCodeFence", () => {
  it("detects backtick, tilde and indented fences", () => {
    assert.ok(containsCodeFence('Here:\n```python\nprint("hi")\n```'));
    assert.ok(containsCodeFence("~~~\necho hi\n~~~"));
    assert.ok(containsCodeFence('Sure.\n   ```\nprint("hi")'));
    assert.ok(containsCodeFence("```js"));
  });

  it("ignores inline code and plain prose", () => {
    assert.ok(!containsCodeFence("Try the `box breathing` exercise."));
    assert.ok(!containsCodeFence("You've got this. One day at a time."));
    assert.ok(!containsCodeFence("Some text ``` mid-line"));
  });
});

describe("guardReply", () => {
  it("passes text without a fence through unchanged", () => {
    const text = "Take a breath with me.\n\n1. In for 4\n2. Hold for 4";
    assert.equal(guardReply(text), text);
  });

  it("replaces fenced code with the off-topic reply", () => {
    assert.equal(
      guardReply(
        'Here is the Python script:\n\n```python\nprint("Hello, world!")\n```\n\nHow are things going?',
      ),
      OFF_TOPIC_REPLY,
    );
    assert.equal(guardReply("```\nrm -rf /\n```"), OFF_TOPIC_REPLY);
  });

  it("keeps crisis prose and strips the code when a reply has both", () => {
    const reply =
      "I'm really glad you told me. Please call or text 988 right now.\n\n```\nprint(1)\n```\n\nI'm here with you.";
    assert.equal(
      guardReply(reply),
      "I'm really glad you told me. Please call or text 988 right now.\n\nI'm here with you.",
    );
  });

  it("recognises non-US crisis wording", () => {
    const reply =
      "Please contact your local emergency number now.\n~~~\necho hi\n~~~";
    assert.equal(
      guardReply(reply),
      "Please contact your local emergency number now.",
    );
  });

  it("strips an unclosed fence to the end", () => {
    assert.equal(
      guardReply(
        "Call 911 if you're in danger.\n```python\nwhile True:\n  pass",
      ),
      "Call 911 if you're in danger.",
    );
    assert.equal(guardReply("```python\nwhile True:"), OFF_TOPIC_REPLY);
  });

  it("only counts crisis markers in the prose, not in the code", () => {
    assert.equal(guardReply("```\nx = 988\n```"), OFF_TOPIC_REPLY);
    assert.equal(
      guardReply(
        "Sure! Here's a script:\n```py\nprint(999)\n```\nThis prints a number.",
      ),
      OFF_TOPIC_REPLY,
    );
  });

  it("closes a block only on a bare fence of the same kind, at least as long", () => {
    assert.equal(
      guardReply(
        "Please call 988.\n````md\n```py\nx\n```\nmore code\n````\nYou can call or text 988 anytime, I'm here.",
      ),
      "Please call 988.\nYou can call or text 988 anytime, I'm here.",
    );
    assert.equal(
      guardReply("Call 988.\n```\na\n```js\nb\n```\nI'm here."),
      "Call 988.\nI'm here.",
    );
    assert.equal(
      guardReply("Call 988.\n~~~\na\n```\nb\n~~~\nI'm here."),
      "Call 988.\nI'm here.",
    );
  });
});
