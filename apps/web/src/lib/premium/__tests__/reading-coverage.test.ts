import { describe, expect, it } from "vitest";

// These imports will fail until reading-coverage.ts is implemented (RED state)
import {
  tokenizeText,
  calculateUnknownRatio,
  verifyCoverage,
} from "../reading-coverage";

describe("tokenizeText", () => {
  it("returns lowercase lemma tokens from a simple string", () => {
    const result = tokenizeText("Hello world foo");
    expect(result).toEqual(["hello", "world", "foo"]);
  });

  it("filters out single-character tokens", () => {
    const result = tokenizeText("I go to a party");
    // 'i' and 'a' are single chars — filtered
    expect(result).not.toContain("i");
    expect(result).not.toContain("a");
    expect(result).toContain("go");
    expect(result).toContain("to");
    expect(result).toContain("party");
  });

  it("strips punctuation and numbers before tokenizing", () => {
    const result = tokenizeText("It's 100% amazing!");
    expect(result).toContain("it");
    expect(result).toContain("amazing");
    expect(result).not.toContain("100");
  });

  it("returns empty array for empty string", () => {
    expect(tokenizeText("")).toEqual([]);
  });

  it("handles non-latin characters by ignoring them", () => {
    const result = tokenizeText("hello 세계 world");
    expect(result).toEqual(["hello", "world"]);
  });
});

describe("calculateUnknownRatio", () => {
  it("returns ~0.5 ratio when half the words are unknown", () => {
    const result = calculateUnknownRatio("hello world", new Set(["hello"]));
    expect(result.unknownRatio).toBeCloseTo(0.5);
    expect(result.unknownWords).toEqual(["world"]);
    expect(result.totalWords).toBe(2);
  });

  it("returns 0 ratio when all words are known", () => {
    const result = calculateUnknownRatio(
      "hello world",
      new Set(["hello", "world"]),
    );
    expect(result.unknownRatio).toBe(0);
    expect(result.unknownWords).toEqual([]);
  });

  it("returns 1.0 ratio when no words are known", () => {
    const result = calculateUnknownRatio("hello world", new Set());
    expect(result.unknownRatio).toBe(1.0);
    expect(result.unknownWords).toContain("hello");
    expect(result.unknownWords).toContain("world");
  });

  it("deduplicates unknown words", () => {
    const result = calculateUnknownRatio("cat cat cat", new Set(["hello"]));
    expect(result.unknownWords).toEqual(["cat"]);
  });

  it("returns 0 ratio for empty text", () => {
    const result = calculateUnknownRatio("", new Set(["hello"]));
    expect(result.unknownRatio).toBe(0);
    expect(result.totalWords).toBe(0);
  });
});

describe("verifyCoverage", () => {
  it("returns too-easy when all words are known (0% unknown)", () => {
    const text = "the quick brown fox";
    const knownLemmas = new Set(["the", "quick", "brown", "fox"]);
    const result = verifyCoverage(text, knownLemmas);
    expect(result.status).toBe("too-easy");
    expect(result.unknownRatio).toBe(0);
  });

  it("returns too-hard when all words are unknown (100% unknown)", () => {
    const text = "obfuscated lexical phantasmagoria";
    const result = verifyCoverage(text, new Set());
    expect(result.status).toBe("too-hard");
    expect(result.unknownRatio).toBe(1.0);
  });

  it("returns optimal when unknown ratio is in 2-5% range", () => {
    // 50 known words + 2 unknown = ~3.8% unknown (in optimal 2-5% range)
    const knownWords = [
      "the",
      "be",
      "to",
      "of",
      "and",
      "in",
      "that",
      "have",
      "it",
      "for",
      "not",
      "on",
      "with",
      "he",
      "as",
      "you",
      "do",
      "at",
      "this",
      "but",
      "his",
      "by",
      "from",
      "they",
      "we",
      "say",
      "her",
      "she",
      "or",
      "an",
      "will",
      "my",
      "one",
      "all",
      "would",
      "there",
      "their",
      "what",
      "so",
      "up",
      "out",
      "if",
      "about",
      "who",
      "get",
      "which",
      "go",
      "me",
      "when",
      "make",
    ];
    const text = [...knownWords, "zygote", "phlox"].join(" ");
    const knownLemmas = new Set(knownWords);
    const result = verifyCoverage(text, knownLemmas);
    expect(result.status).toBe("optimal");
    expect(result.unknownWords).toContain("zygote");
    expect(result.unknownWords).toContain("phlox");
  });

  it("returns unknown words list with the coverage result", () => {
    const result = verifyCoverage("hello world test", new Set(["hello"]));
    expect(result.unknownWords).toContain("world");
    expect(result.unknownWords).toContain("test");
  });
});
