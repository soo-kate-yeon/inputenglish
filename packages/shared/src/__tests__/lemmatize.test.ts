import { describe, expect, it } from "vitest";
import { hasKnownWord, lemmaCandidates } from "../lib/lemmatize";

describe("lemmaCandidates", () => {
  it("always includes the lowercased token itself", () => {
    expect(lemmaCandidates("Invest")).toContain("invest");
  });

  it("strips regular plural / 3rd-person -s", () => {
    expect(lemmaCandidates("costs")).toContain("cost");
    expect(lemmaCandidates("benefits")).toContain("benefit");
  });

  it("recovers the base from -es endings", () => {
    expect(lemmaCandidates("outlines")).toContain("outline"); // -s → outline
    expect(lemmaCandidates("boxes")).toContain("box"); // -es → box
  });

  it("handles -ies → -y", () => {
    expect(lemmaCandidates("studies")).toContain("study");
    expect(lemmaCandidates("parties")).toContain("party");
  });

  it("strips gerund -ing, including silent-e and doubled consonant", () => {
    expect(lemmaCandidates("investing")).toContain("invest");
    expect(lemmaCandidates("making")).toContain("make");
    expect(lemmaCandidates("running")).toContain("run");
  });

  it("strips past tense -ed / -ied, including doubled consonant", () => {
    expect(lemmaCandidates("worked")).toContain("work");
    expect(lemmaCandidates("used")).toContain("use");
    expect(lemmaCandidates("stopped")).toContain("stop");
    expect(lemmaCandidates("studied")).toContain("study");
  });

  it("does not strip short tokens or double-s plurals into garbage", () => {
    expect(lemmaCandidates("is")).toEqual(["is"]); // too short
    expect(lemmaCandidates("boss")).not.toContain("bos"); // -ss guard
  });
});

describe("hasKnownWord", () => {
  const known = new Set([
    "invest",
    "cost",
    "benefit",
    "outline",
    "study",
    "run",
  ]);

  it("matches the surface form via its lemma", () => {
    expect(hasKnownWord(known, "investing")).toBe(true);
    expect(hasKnownWord(known, "costs")).toBe(true);
    expect(hasKnownWord(known, "outlines")).toBe(true);
    expect(hasKnownWord(known, "studies")).toBe(true);
    expect(hasKnownWord(known, "running")).toBe(true);
  });

  it("matches a base form directly", () => {
    expect(hasKnownWord(known, "invest")).toBe(true);
  });

  it("returns false for genuinely unknown words", () => {
    expect(hasKnownWord(known, "serendipity")).toBe(false);
    expect(hasKnownWord(known, "our")).toBe(false);
  });
});
