import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_SYSTEM_PROMPT } from "../systemPrompt.mjs";
import { SAFETY_FALLBACK_REPLY } from "../fallback.mjs";

describe("system prompt crisis guidance", () => {
  const crisis = BASE_SYSTEM_PROMPT.slice(
    BASE_SYSTEM_PROMPT.indexOf("Crisis resources:"),
  );

  it("has a crisis-resources section", () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes("Crisis resources:"));
    assert.match(
      BASE_SYSTEM_PROMPT,
      /Only bring up hotlines or crisis resources in the situations described under "Crisis resources" below, or when the user asks for them\./,
    );
    assert.ok(
      !BASE_SYSTEM_PROMPT.includes(
        "unless the user explicitly indicates they are in crisis",
      ),
    );
  });

  it("does not treat cravings, urges or relapse as a crisis", () => {
    assert.match(
      crisis,
      /Cravings, urges, saying they really want to drink or use right now, having relapsed/,
    );
    assert.match(crisis, /not a crisis/);
    assert.match(crisis, /Do not point them to a hotline for these/);
  });

  it("offers resources on stated or clearly implied acute danger", () => {
    assert.match(crisis, /stated outright or clearly implied/);
    for (const sign of [
      "suicide",
      "self-harm",
      "harm someone else",
      "overdose",
      "immediate danger",
    ]) {
      assert.ok(crisis.includes(sign), sign);
    }
  });

  it("lets acute danger override the craving/relapse carve-out", () => {
    assert.match(
      crisis,
      /they take priority over the craving and relapse guidance above/,
    );
    assert.match(
      crisis,
      /the distraction and "this conversation counts as reaching out" guidance above is for ordinary cravings, not acute danger/,
    );
  });

  it("labels US numbers as US, covers elsewhere, and keeps supporting", () => {
    assert.match(
      crisis,
      /In the US: for thoughts of suicide or self-harm, call or text 988 \(Suicide & Crisis Lifeline\)/,
    );
    assert.match(
      crisis,
      /for a possible overdose, severe withdrawal, violence, or immediate danger, call 911/,
    );
    assert.match(
      crisis,
      /Outside the US, point them to their local emergency number or crisis line/,
    );
    assert.match(
      crisis,
      /SAMHSA National Helpline \(US, free, 24\/7\): 1-800-662-4357/,
    );
    assert.match(crisis, /keep supporting them in the conversation/);
  });
});

describe("safety fallback reply", () => {
  it("mentions crisis resources conditionally and keeps the conversation open", () => {
    assert.match(
      SAFETY_FALLBACK_REPLY,
      /If you're thinking about hurting yourself or you're in danger/,
    );
    assert.match(
      SAFETY_FALLBACK_REPLY,
      /in the US, call or text 988 or call 911/,
    );
    assert.match(
      SAFETY_FALLBACK_REPLY,
      /elsewhere, your local emergency number/,
    );
    assert.match(SAFETY_FALLBACK_REPLY, /I'm still here with you\.$/);
  });
});
