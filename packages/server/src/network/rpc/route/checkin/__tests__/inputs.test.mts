import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCheckInInput } from "../create.mjs";
import { createJournalEntryInput } from "../../journal/create.mjs";

const base = { journeyId: "j", mood: "GOOD" as const };

describe("checkin inputs", () => {
  it("rounds fractional urge strengths", () => {
    assert.equal(
      createCheckInInput.parse({ ...base, urgeStrength: 3.5 }).urgeStrength,
      4,
    );
    assert.equal(
      createCheckInInput.parse({ ...base, urgeStrength: 7.2 }).urgeStrength,
      7,
    );
  });

  it("keeps integer urge strengths", () => {
    for (let i = 1; i <= 10; i++) {
      assert.equal(
        createCheckInInput.parse({ ...base, urgeStrength: i }).urgeStrength,
        i,
      );
    }
  });

  it("still rejects out of range urge strengths", () => {
    for (const urgeStrength of [0, 0.6, 10.4, 11]) {
      assert.equal(
        createCheckInInput.safeParse({ ...base, urgeStrength }).success,
        false,
        String(urgeStrength),
      );
    }
  });

  it("bounds journal content generously", () => {
    assert.equal(
      createJournalEntryInput.safeParse({ content: "a".repeat(100_000) })
        .success,
      true,
    );
    assert.equal(
      createJournalEntryInput.safeParse({ content: "a".repeat(100_001) })
        .success,
      false,
    );
    assert.equal(
      createCheckInInput.safeParse({
        ...base,
        urgeStrength: 1,
        journalEntry: "a".repeat(100_001),
      }).success,
      false,
    );
  });
});
