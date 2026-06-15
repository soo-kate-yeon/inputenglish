/**
 * Tests for apps/web/src/lib/premium/band-coverage.ts
 *
 * RED phase: All tests fail until band-coverage.ts is implemented.
 * TDD cycle: RED → GREEN → REFACTOR
 *
 * AC-001-3: band_coverage non-empty
 * AC-001-3: topic_tags non-empty
 */
import { describe, expect, it } from "vitest";

import { computeBandCoverage, extractTopicTags } from "../band-coverage";

// ═══════════════════════════════════════════════════════════════════════════
// computeBandCoverage
// ═══════════════════════════════════════════════════════════════════════════
describe("computeBandCoverage", () => {
  it("returns a record with all four band keys", () => {
    const result = computeBandCoverage("the cat sat on the mat");
    expect(result).toHaveProperty("beginner");
    expect(result).toHaveProperty("basic");
    expect(result).toHaveProperty("conversation");
    expect(result).toHaveProperty("professional");
  });

  it("returns non-empty object (never {})", () => {
    const result = computeBandCoverage("hello world this is a test");
    // Must have at least some coverage values (not all 0 is acceptable but object must have keys)
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it("all coverage values are between 0 and 1 inclusive", () => {
    const result = computeBandCoverage(
      "the quick brown fox jumps over the lazy dog",
    );
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("beginner coverage is high for very common words", () => {
    // "the" and "of" are among the most frequent English words (in beginner band)
    const result = computeBandCoverage("the the the of of of");
    // All tokens are beginner words → beginner coverage should be close to 1
    expect(result.beginner).toBeCloseTo(1, 1);
  });

  it("handles empty string without throwing, returning zeros", () => {
    const result = computeBandCoverage("");
    expect(result).toHaveProperty("beginner");
    expect(result.beginner).toBe(0);
    expect(result.basic).toBe(0);
    expect(result.conversation).toBe(0);
    expect(result.professional).toBe(0);
  });

  it("returns cumulative coverage (professional includes beginner words)", () => {
    // Since band coverage is cumulative, professional coverage >= basic >= beginner
    // for any given text
    const result = computeBandCoverage(
      "the quick brown fox technology entrepreneurship",
    );
    // professional band covers more words so its coverage >= beginner
    expect(result.professional).toBeGreaterThanOrEqual(result.beginner - 0.01);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractTopicTags
// ═══════════════════════════════════════════════════════════════════════════
describe("extractTopicTags", () => {
  it("returns a non-empty array (at minimum ['general'])", () => {
    const result = extractTopicTags("some random text about nothing specific");
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back to ['general'] when no specific topic is detected", () => {
    const result = extractTopicTags("blah blah blah");
    expect(result).toContain("general");
  });

  it("detects 'technology' topic from tech keywords", () => {
    const result = extractTopicTags(
      "artificial intelligence machine learning algorithm software engineer coding",
    );
    expect(result.some((t) => t === "technology" || t === "tech")).toBe(true);
  });

  it("detects 'business' topic from business keywords", () => {
    const result = extractTopicTags(
      "quarterly earnings revenue profit market share investors shareholder",
    );
    expect(result.some((t) => t === "business" || t === "economy")).toBe(true);
  });

  it("returns string array with no duplicates", () => {
    const result = extractTopicTags(
      "technology technology technology software software",
    );
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it("returns at most 5 tags", () => {
    const result = extractTopicTags(
      "technology business politics health science sports entertainment education",
    );
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
