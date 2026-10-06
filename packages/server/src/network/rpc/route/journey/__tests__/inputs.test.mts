import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJourneyInput } from "../create.mjs";
import { updateJourneyInput } from "../update.mjs";
import { reorderJourneyInput } from "../reorder.mjs";

const journeyId = "00000000-0000-4000-8000-000000000000";

describe("journey inputs", () => {
  it("trims titles", () => {
    const parsed = createJourneyInput.parse({
      title: "  Alcohol  ",
      startDateTime: new Date("2024-01-01"),
    });
    assert.equal(parsed.title, "Alcohol");
    assert.equal(
      updateJourneyInput.parse({ journeyId, title: " Nicotine " }).title,
      "Nicotine",
    );
  });

  it("keeps whitespace-only titles instead of rejecting them", () => {
    assert.equal(
      createJourneyInput.parse({ title: "   ", startDateTime: new Date() })
        .title,
      "   ",
    );
    assert.equal(
      updateJourneyInput.parse({ journeyId, title: " " }).title,
      " ",
    );
  });

  it("still rejects empty and oversized titles", () => {
    assert.equal(
      createJourneyInput.safeParse({ title: "", startDateTime: new Date() })
        .success,
      false,
    );
    assert.equal(
      updateJourneyInput.safeParse({ journeyId, title: "a".repeat(1001) })
        .success,
      false,
    );
    assert.equal(
      updateJourneyInput.safeParse({ journeyId, title: "a".repeat(1000) })
        .success,
      true,
    );
  });

  it("clamps a future start date to now", () => {
    const before = Date.now();
    const parsed = createJourneyInput.parse({
      title: "t",
      startDateTime: new Date(Date.now() + 86_400_000),
    });
    assert.ok(parsed.startDateTime.getTime() >= before);
    assert.ok(parsed.startDateTime.getTime() <= Date.now());
  });

  it("keeps a past start date", () => {
    const past = new Date("2020-05-05T10:00:00Z");
    assert.equal(
      createJourneyInput
        .parse({ title: "t", startDateTime: past })
        .startDateTime.getTime(),
      past.getTime(),
    );
  });

  it("bounds reorder items generously", () => {
    const items = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: journeyId, position: i }));
    assert.equal(
      reorderJourneyInput.safeParse({ items: items(1000) }).success,
      true,
    );
    assert.equal(
      reorderJourneyInput.safeParse({ items: items(1001) }).success,
      false,
    );
  });
});
