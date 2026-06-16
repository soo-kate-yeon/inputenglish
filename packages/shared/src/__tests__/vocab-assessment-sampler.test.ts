/**
 * RED phase: Tests for vocab-assessment-sampler.ts
 *
 * SPEC-INPUT-003 REQ-VOCAB-A — Yes/No Assessment item sampler.
 * All tests written BEFORE implementation (TDD discipline).
 *
 * Test plan:
 *  - buildAssessmentItems: returns N real words per band + M pseudowords
 *  - Item shape: { token, isReal, band }
 *  - Real words: band matches bandForLemma, isReal=true
 *  - Pseudowords: isReal=false, band=null, none collide with NGSL
 *  - Determinism: same seed → same item set
 *  - assertFrequencyListLoaded called (guard is wired)
 */

import { describe, expect, it } from "vitest";
import {
  buildAssessmentItems,
  PSEUDOWORDS,
  type AssessmentItem,
} from "../lib/vocab-assessment-sampler";
import { getLemmaRank, bandForLemma } from "../lib/frequency-list";

// ── buildAssessmentItems ──────────────────────────────────────────────────────

describe("buildAssessmentItems — item set construction", () => {
  const DEFAULT_CONFIG = {
    wordsPerBand: 10,
    pseudowordCount: 5,
    seed: 42,
  };

  it("returns an array of AssessmentItem objects", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("returns (wordsPerBand × 4 bands) + pseudowordCount items total", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    // 10 × 4 bands + 5 pseudowords = 45
    expect(items.length).toBe(10 * 4 + 5);
  });

  it("each item has token (string), isReal (boolean), band (VocabBand | 'advanced' | null)", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    for (const item of items) {
      expect(typeof item.token).toBe("string");
      expect(item.token.length).toBeGreaterThan(0);
      expect(typeof item.isReal).toBe("boolean");
      // band is null for pseudowords, VocabBand|"advanced" for real
      if (item.isReal) {
        expect(item.band).not.toBeNull();
      } else {
        expect(item.band).toBeNull();
      }
    }
  });

  it("real-word items: band matches bandForLemma(token)", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const realItems = items.filter((i: AssessmentItem) => i.isReal);
    for (const item of realItems) {
      expect(item.band).toBe(bandForLemma(item.token));
    }
  });

  it("exactly wordsPerBand items come from beginner band", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const beginnerItems = items.filter(
      (i: AssessmentItem) => i.isReal && i.band === "beginner",
    );
    expect(beginnerItems.length).toBe(10);
  });

  it("exactly wordsPerBand items come from basic band", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const basicItems = items.filter(
      (i: AssessmentItem) => i.isReal && i.band === "basic",
    );
    expect(basicItems.length).toBe(10);
  });

  it("exactly wordsPerBand items come from conversation band", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const convItems = items.filter(
      (i: AssessmentItem) => i.isReal && i.band === "conversation",
    );
    expect(convItems.length).toBe(10);
  });

  it("exactly wordsPerBand items come from professional band", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const profItems = items.filter(
      (i: AssessmentItem) => i.isReal && i.band === "professional",
    );
    expect(profItems.length).toBe(10);
  });

  it("exactly pseudowordCount items are pseudowords (isReal=false)", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const pseudoItems = items.filter((i: AssessmentItem) => !i.isReal);
    expect(pseudoItems.length).toBe(5);
  });

  it("pseudoword items have band=null", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const pseudoItems = items.filter((i: AssessmentItem) => !i.isReal);
    for (const item of pseudoItems) {
      expect(item.band).toBeNull();
    }
  });

  it("no pseudoword collides with NGSL (none have a rank)", () => {
    const items = buildAssessmentItems(DEFAULT_CONFIG);
    const pseudoItems = items.filter((i: AssessmentItem) => !i.isReal);
    for (const item of pseudoItems) {
      expect(getLemmaRank(item.token)).toBeNull();
    }
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe("buildAssessmentItems — determinism with same seed", () => {
  it("same seed produces identical token list", () => {
    const cfg = { wordsPerBand: 5, pseudowordCount: 3, seed: 99 };
    const a = buildAssessmentItems(cfg).map((i) => i.token);
    const b = buildAssessmentItems(cfg).map((i) => i.token);
    expect(a).toEqual(b);
  });

  it("different seeds produce different item sets (with high probability)", () => {
    const cfgA = { wordsPerBand: 10, pseudowordCount: 5, seed: 1 };
    const cfgB = { wordsPerBand: 10, pseudowordCount: 5, seed: 2 };
    const tokensA = buildAssessmentItems(cfgA).map((i) => i.token);
    const tokensB = buildAssessmentItems(cfgB).map((i) => i.token);
    // Not all tokens should be identical
    const allSame = tokensA.every((t, idx) => t === tokensB[idx]);
    expect(allSame).toBe(false);
  });
});

// ── PSEUDOWORDS export ─────────────────────────────────────────────────────────

describe("PSEUDOWORDS constant — curated list validation", () => {
  it("exports a non-empty array of pseudowords", () => {
    expect(Array.isArray(PSEUDOWORDS)).toBe(true);
    expect(PSEUDOWORDS.length).toBeGreaterThan(0);
  });

  it("all pseudowords are strings with length >= 3", () => {
    for (const pw of PSEUDOWORDS) {
      expect(typeof pw).toBe("string");
      expect(pw.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("no pseudoword appears in the NGSL frequency list", () => {
    for (const pw of PSEUDOWORDS) {
      expect(getLemmaRank(pw)).toBeNull();
    }
  });

  it("has at least 20 pseudowords (to allow variety across test runs)", () => {
    expect(PSEUDOWORDS.length).toBeGreaterThanOrEqual(20);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("buildAssessmentItems — edge cases", () => {
  it("wordsPerBand=1 pseudowordCount=1 → 5 items total", () => {
    const items = buildAssessmentItems({
      wordsPerBand: 1,
      pseudowordCount: 1,
      seed: 0,
    });
    expect(items.length).toBe(5); // 1×4 + 1
  });

  it("wordsPerBand=0 pseudowordCount=5 → 5 pseudoword-only items", () => {
    const items = buildAssessmentItems({
      wordsPerBand: 0,
      pseudowordCount: 5,
      seed: 0,
    });
    expect(items.length).toBe(5);
    expect(items.every((i) => !i.isReal)).toBe(true);
  });

  it("real tokens are unique within their band slice", () => {
    const items = buildAssessmentItems({
      wordsPerBand: 10,
      pseudowordCount: 5,
      seed: 7,
    });
    const realTokens = items.filter((i) => i.isReal).map((i) => i.token);
    const unique = new Set(realTokens);
    expect(unique.size).toBe(realTokens.length);
  });

  it("professional band items: capped at available words (≤807 in NGSL)", () => {
    // Request more than available in professional band (807 words in NGSL)
    const items = buildAssessmentItems({
      wordsPerBand: 900,
      pseudowordCount: 0,
      seed: 0,
    });
    const profItems = items.filter(
      (i: AssessmentItem) => i.isReal && i.band === "professional",
    );
    // Should not exceed available words
    expect(profItems.length).toBeLessThanOrEqual(807);
  });
});
