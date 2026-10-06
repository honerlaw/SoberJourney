import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  generateTitle,
  sanitizeTitle,
  TITLE_MAX_LENGTH,
} from "../generateTitle.mjs";

type Ctx = Parameters<typeof generateTitle>[0];

function ctxWith(result: unknown) {
  const setTitleIfNull = mock.fn(async () => true);
  const chat = mock.fn(async () => result);
  const ctx = {
    datasource: { gemini: { chat } },
    database: { conversation: { setTitleIfNull } },
  } as unknown as Ctx;
  return { ctx, setTitleIfNull, chat };
}

describe("sanitizeTitle", () => {
  it("strips quotes, newlines, markdown and trailing punctuation", () => {
    assert.equal(
      sanitizeTitle('"Finding Strength Today."\n'),
      "Finding Strength Today",
    );
    assert.equal(sanitizeTitle("**Title:** Hope\nAhead!"), "Hope Ahead");
    assert.equal(sanitizeTitle("`One   Step`"), "One Step");
    assert.equal(sanitizeTitle("“New Beginnings”"), "New Beginnings");
  });

  it("keeps apostrophes inside words", () => {
    assert.equal(
      sanitizeTitle("'Don't Give Up Today.'"),
      "Don't Give Up Today",
    );
    assert.equal(sanitizeTitle("Today's Progress"), "Today's Progress");
    assert.equal(
      sanitizeTitle("\u2018You\u2019ve Got This\u2019"),
      "You\u2019ve Got This",
    );
  });

  it("caps the length at a word boundary", () => {
    const title = sanitizeTitle("word ".repeat(40));
    assert.ok(title);
    assert.ok(title.length <= TITLE_MAX_LENGTH);
    assert.ok(!title.endsWith(" "));
    assert.ok(title.split(" ").every((w) => w === "word"));
  });

  it("returns null for nothing usable", () => {
    assert.equal(sanitizeTitle('  "" \n'), null);
    assert.equal(sanitizeTitle("..."), null);
  });
});

describe("generateTitle", () => {
  it("stores a sanitized title with a conditional (title: null) update", async () => {
    const { ctx, setTitleIfNull } = ctxWith({
      status: "ok",
      text: '"Hope Ahead."',
    });
    await generateTitle(ctx, "c1", "u1", "I made it a week");
    assert.equal(setTitleIfNull.mock.callCount(), 1);
    assert.deepEqual(setTitleIfNull.mock.calls[0]!.arguments, [
      "c1",
      "u1",
      "Hope Ahead",
    ]);
  });

  it("does not store anything when the model blocks or truncates", async () => {
    for (const result of [
      { status: "blocked", reason: "SAFETY" },
      { status: "truncated", text: "Hope" },
    ]) {
      const { ctx, setTitleIfNull } = ctxWith(result);
      await generateTitle(ctx, "c1", "u1", "text");
      assert.equal(setTitleIfNull.mock.callCount(), 0);
    }
  });
});
