import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_SYSTEM_PROMPT } from "../systemPrompt.mjs";
import {
  BLOCKED_FALLBACK_REPLY,
  FALLBACK_REPLIES,
  SAFETY_FALLBACK_REPLY,
  fallbackReplyFor,
} from "../fallback.mjs";

describe("system prompt crisis guidance", () => {
  const heading = BASE_SYSTEM_PROMPT.indexOf("Crisis resources:");
  const crisis = BASE_SYSTEM_PROMPT.slice(heading);

  it("has a crisis-resources section referenced from the guidelines", () => {
    assert.ok(heading >= 0);
    assert.ok(heading > BASE_SYSTEM_PROMPT.indexOf('under "Crisis resources"'));
    assert.ok(
      !BASE_SYSTEM_PROMPT.includes("explicitly indicates they are in crisis"),
    );
  });

  it("does not treat cravings, urges, relapse or check-in levels as a crisis", () => {
    for (const phrase of [
      "Cravings",
      "want to drink or use right now",
      "relapsed",
      "not a crisis",
      "check-in",
    ]) {
      assert.ok(crisis.includes(phrase), phrase);
    }
  });

  it("offers resources on stated or clearly implied acute danger, with priority", () => {
    for (const phrase of [
      "clearly implied",
      "suicide",
      "self-harm",
      "harm someone else",
      "overdose",
      "after time sober",
      "severe withdrawal",
      "immediate danger",
      "priority",
    ]) {
      assert.ok(crisis.includes(phrase), phrase);
    }
  });

  it("labels US numbers, covers elsewhere, and keeps supporting", () => {
    for (const phrase of [
      "In the US",
      "988",
      "911",
      "Outside the US",
      "1-800-662-4357",
      "keep supporting",
    ]) {
      assert.ok(crisis.includes(phrase), phrase);
    }
  });
});

describe("fallback replies", () => {
  it("only harmful-content blocks get the conditional crisis line", () => {
    assert.equal(fallbackReplyFor("SAFETY"), SAFETY_FALLBACK_REPLY);
    assert.equal(fallbackReplyFor("PROHIBITED_CONTENT"), SAFETY_FALLBACK_REPLY);
    for (const reason of ["RECITATION", "SPII", "BLOCKLIST", "OTHER"]) {
      assert.equal(fallbackReplyFor(reason), BLOCKED_FALLBACK_REPLY, reason);
    }
    assert.ok(!BLOCKED_FALLBACK_REPLY.includes("988"));
  });

  it("the safety fallback mentions resources conditionally, US-labelled", () => {
    assert.ok(
      SAFETY_FALLBACK_REPLY.includes(
        "If you're thinking about hurting yourself",
      ),
    );
    for (const phrase of [
      "in the US",
      "988",
      "911",
      "local emergency number",
    ]) {
      assert.ok(SAFETY_FALLBACK_REPLY.includes(phrase), phrase);
    }
  });

  it("both fallbacks are recognised for history exclusion", () => {
    assert.ok(FALLBACK_REPLIES.has(SAFETY_FALLBACK_REPLY));
    assert.ok(FALLBACK_REPLIES.has(BLOCKED_FALLBACK_REPLY));
  });
});
