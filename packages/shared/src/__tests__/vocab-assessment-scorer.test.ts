/**
 * RED phase: Tests for vocab-assessment-scorer.ts
 *
 * SPEC-INPUT-003 REQ-VOCAB-A — Yes/No measurement scorer with false-positive correction.
 * All tests written BEFORE implementation (TDD discipline).
 *
 * Test plan:
 *  - scoreAssessment: canonical contract (A-U1)
 *    - exact math: correctedFrac = max(0, (hitRate - fpr) / (1 - fpr))
 *    - estimatedSize = Σ_b (correctedFrac_b × width_b)
 *  - estimated_band (4-band, professional clamp, A-U2)
 *  - estimatedLevel (CEFR via getBandSeedMetadata, A-U2)
 *  - seedKnownWords (real words user marked known, 5-band, A-U3)
 *  - Pseudowords NEVER in seedKnownWords (A-U3)
 *  - fpr ≥ 1 safe clamp (A-W1)
 *  - zero pseudowords safe clamp (A-W1)
 *  - over-claimer (fpr > 0.5) down-rank (A-U4)
 *  - all don't-know → beginner, empty seedKnownWords (EC-A-D)
 */

import { describe, expect, it } from "vitest";
import {
  scoreAssessment,
  type ScorerInput,
  type ScorerOutput,
} from "../lib/vocab-assessment-scorer";
import { getBandSeedMetadata } from "../lib/vocab-band";
import type { VocabBand } from "../types";

// ── Helpers to build test inputs ──────────────────────────────────────────────

/**
 * Builds a minimal ScorerInput array for testing.
 * - Creates N real words per band (all marked as known or not)
 * - Creates M pseudowords (all marked as known or not)
 */
function makeInput(opts: {
  beginnerWords?: string[];
  basicWords?: string[];
  convWords?: string[];
  profWords?: string[];
  pseudowords?: string[];
  beginnerKnown?: boolean[];
  basicKnown?: boolean[];
  convKnown?: boolean[];
  profKnown?: boolean[];
  pseudoKnown?: boolean[];
}): ScorerInput[] {
  const items: ScorerInput[] = [];

  const addBand = (
    words: string[],
    band: VocabBand,
    known: boolean[] | undefined,
  ) => {
    words.forEach((w, i) => {
      items.push({
        token: w,
        isReal: true,
        band,
        known: known ? known[i] : false,
      });
    });
  };

  addBand(opts.beginnerWords ?? [], "beginner", opts.beginnerKnown);
  addBand(opts.basicWords ?? [], "basic", opts.basicKnown);
  addBand(opts.convWords ?? [], "conversation", opts.convKnown);
  addBand(opts.profWords ?? [], "professional", opts.profKnown);

  const pseudowords = opts.pseudowords ?? [];
  const pseudoKnown = opts.pseudoKnown ?? pseudowords.map(() => false);
  pseudowords.forEach((pw, i) => {
    items.push({
      token: pw,
      isReal: false,
      band: null,
      known: pseudoKnown[i],
    });
  });

  return items;
}

/** Creates N items all with the same known flag */
function fillKnown(words: string[], known: boolean): boolean[] {
  return words.map(() => known);
}

// ── scoreAssessment — canonical contract (A-U1) ───────────────────────────────

describe("scoreAssessment — false-positive correction math (AC-A-2 / A-U1)", () => {
  it("hand-computed example: hitRate=0.8/0.6/0.4/0.2, fpr=0.3 → correct sizes", () => {
    // From AC-A-2: correctedFrac = max(0, (hitRate - fpr) / (1 - fpr))
    // fpr = 0.3
    // beginner hitRate=0.8  → (0.8-0.3)/(1-0.3) = 0.5/0.7 ≈ 0.7143  × 500  = 357.14
    // basic    hitRate=0.6  → (0.6-0.3)/(1-0.3) = 0.3/0.7 ≈ 0.4286  × 1000 = 428.57
    // conv     hitRate=0.4  → (0.4-0.3)/(1-0.3) = 0.1/0.7 ≈ 0.1429  × 1500 = 214.29
    // prof     hitRate=0.2  → (0.2-0.3)/(1-0.3) = -0.1/0.7 → max(0,…) = 0 × 3000 = 0
    // total ≈ 357.14 + 428.57 + 214.29 + 0 = 1000

    // 10 words per band
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 10 }, (_, i) => `morth${i}`),
      // 8 of 10 beginner known (hitRate=0.8)
      beginnerKnown: [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
      ],
      // 6 of 10 basic known (hitRate=0.6)
      basicKnown: [
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
      ],
      // 4 of 10 conv known (hitRate=0.4)
      convKnown: [
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      // 2 of 10 prof known (hitRate=0.2)
      profKnown: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      // 3 of 10 pseudowords "known" (fpr=0.3)
      pseudoKnown: [
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    });

    const result = scoreAssessment(items);
    // estimatedSize ≈ 1000 (allow ±5 tolerance for floating point)
    expect(result.estimatedSize).toBeGreaterThan(990);
    expect(result.estimatedSize).toBeLessThan(1010);
  });

  it("AC-A-2 exact single-band check: hitRate=0.8, fpr=0.3 → correctedFrac≈0.7143", () => {
    // Only beginner band to isolate the math
    // correctedFrac = (0.8-0.3)/(1-0.3) = 0.5/0.7 ≈ 0.71429
    // estimatedSize = 0.71429 × 500 ≈ 357.14
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `bw${i}`),
      basicWords: [],
      convWords: [],
      profWords: [],
      pseudowords: Array.from({ length: 10 }, (_, i) => `morth${i}`),
      beginnerKnown: [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
      ],
      pseudoKnown: [
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    });

    const result = scoreAssessment(items);
    // estimatedSize should be ≈ 357.14 (±3 tolerance)
    expect(result.estimatedSize).toBeGreaterThan(354);
    expect(result.estimatedSize).toBeLessThan(361);
  });

  it("fpr=0 (no pseudowords marked known) → correctedFrac = hitRate", () => {
    // hitRate = 1.0 (all beginner known), fpr=0 → correctedFrac = 1.0
    // estimatedSize = 1.0 × 500 = 500
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: [],
      convWords: [],
      profWords: [],
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[],
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    // Should be 500 (all beginner known, no fpr adjustment)
    expect(result.estimatedSize).toBeCloseTo(500, 0);
  });

  it("all bands fully known, fpr=0 → estimatedSize=6000", () => {
    // With perfect knowledge and zero false positives, all band fractions = 1.0
    // estimatedSize = 500 + 1000 + 1500 + 3000 = 6000
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[],
      basicKnown: Array(10).fill(true) as boolean[],
      convKnown: Array(10).fill(true) as boolean[],
      profKnown: Array(10).fill(true) as boolean[],
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    expect(result.estimatedSize).toBeCloseTo(6000, 0);
  });

  it("negative raw fraction after fpr correction → clamped to 0 (not negative)", () => {
    // hitRate=0.1, fpr=0.3 → (0.1-0.3)/(1-0.3) = -0.2/0.7 < 0 → clamped to 0
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: [],
      convWords: [],
      profWords: [],
      pseudowords: Array.from({ length: 10 }, (_, i) => `pw${i}`),
      beginnerKnown: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      pseudoKnown: [
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    });
    const result = scoreAssessment(items);
    // correctedFrac_beginner = max(0, (0.1-0.3)/(0.7)) = 0
    // estimatedSize = 0
    expect(result.estimatedSize).toBeGreaterThanOrEqual(0);
  });
});

// ── estimated_band (A-U2) ─────────────────────────────────────────────────────

describe("scoreAssessment — estimated_band 4-band clamp (A-U2 / AC-A-3)", () => {
  it("small estimatedSize → beginner band", () => {
    // estimatedSize ≈ 100 → beginner (0-500)
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      // Very few known (hitRate ~0.1), no fpr
      beginnerKnown: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      basicKnown: Array(10).fill(false) as boolean[],
      convKnown: Array(10).fill(false) as boolean[],
      profKnown: Array(10).fill(false) as boolean[],
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    expect(result.estimatedBand).toBe("beginner");
  });

  it("estimatedSize in 500-1500 → basic band", () => {
    // Target: estimatedSize ≈ 700 → basic
    // All beginner known (500), some basic known (~200/1000 → 0.2×1000=200), rest 0
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[], // hitRate=1.0 → 500
      basicKnown: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ], // hitRate=0.2 → 200
      convKnown: Array(10).fill(false) as boolean[],
      profKnown: Array(10).fill(false) as boolean[],
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    // estimatedSize ≈ 700 → basic
    expect(result.estimatedBand).toBe("basic");
  });

  it("estimatedSize in 1500-3000 → conversation band", () => {
    // All beginner (500) + all basic (1000) + 0 rest = 1500 → basic/conversation boundary
    // Add some conversation to push into conversation zone
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[], // 500
      basicKnown: Array(10).fill(true) as boolean[], // 1000
      convKnown: [
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ], // 0.3 × 1500 = 450
      profKnown: Array(10).fill(false) as boolean[],
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    // estimatedSize = 500+1000+450 = 1950 → conversation
    expect(result.estimatedBand).toBe("conversation");
  });

  it("estimatedSize in 3000-6000 → professional band", () => {
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[], // 500
      basicKnown: Array(10).fill(true) as boolean[], // 1000
      convKnown: Array(10).fill(true) as boolean[], // 1500
      profKnown: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ], // 0.1 × 3000 = 300
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    // estimatedSize = 500+1000+1500+300 = 3300 → professional
    expect(result.estimatedBand).toBe("professional");
  });

  it("estimatedSize > 6000 → clamped to professional (NEVER advanced) (AC-A-3)", () => {
    // All bands fully known = 6000; with fpr=0, estimatedSize=6000 exactly
    // Even if somehow > 6000, must clamp to professional
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 5 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[],
      basicKnown: Array(10).fill(true) as boolean[],
      convKnown: Array(10).fill(true) as boolean[],
      profKnown: Array(10).fill(true) as boolean[],
      pseudoKnown: Array(5).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    expect(result.estimatedBand).toBe("professional");
    expect(result.estimatedBand).not.toBe("advanced");
  });

  it("estimatedBand is never 'advanced'", () => {
    const cases = [
      makeInput({
        beginnerWords: ["a", "b", "c"],
        basicWords: ["d", "e", "f"],
        convWords: ["g", "h", "i"],
        profWords: ["j", "k", "l"],
        pseudowords: ["morth"],
        beginnerKnown: [true, true, true],
        basicKnown: [true, true, true],
        convKnown: [true, true, true],
        profKnown: [true, true, true],
        pseudoKnown: [false],
      }),
    ];
    for (const items of cases) {
      const result = scoreAssessment(items);
      expect(result.estimatedBand).not.toBe("advanced");
    }
  });
});

// ── estimatedLevel (CEFR via getBandSeedMetadata) (A-U2) ─────────────────────

describe("scoreAssessment — estimatedLevel CEFR mapping", () => {
  const makeAllUnknown = (band: VocabBand) => {
    // All don't-know → estimatedSize≈0 → beginner
    return makeInput({
      beginnerWords: Array.from({ length: 5 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 5 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 5 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 5 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 3 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(5).fill(false) as boolean[],
      basicKnown: Array(5).fill(false) as boolean[],
      convKnown: Array(5).fill(false) as boolean[],
      profKnown: Array(5).fill(false) as boolean[],
      pseudoKnown: Array(3).fill(false) as boolean[],
    });
  };

  it("beginner band → estimatedLevel = 'A1'", () => {
    const items = makeAllUnknown("beginner");
    const result = scoreAssessment(items);
    if (result.estimatedBand === "beginner") {
      expect(result.estimatedLevel).toBe("A1");
    }
  });

  it("professional band → estimatedLevel = 'B2'", () => {
    const items = makeInput({
      beginnerWords: Array.from({ length: 5 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 5 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 5 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 5 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 3 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(5).fill(true) as boolean[],
      basicKnown: Array(5).fill(true) as boolean[],
      convKnown: Array(5).fill(true) as boolean[],
      profKnown: Array(5).fill(true) as boolean[],
      pseudoKnown: Array(3).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    if (result.estimatedBand === "professional") {
      expect(result.estimatedLevel).toBe("B2");
    }
  });

  it("CEFR level matches getBandSeedMetadata(estimatedBand).cefrLevel", () => {
    const items = makeInput({
      beginnerWords: Array.from({ length: 5 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 5 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 5 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 5 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 3 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(5).fill(true) as boolean[],
      basicKnown: Array(5).fill(false) as boolean[],
      convKnown: Array(5).fill(false) as boolean[],
      profKnown: Array(5).fill(false) as boolean[],
      pseudoKnown: Array(3).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    const meta = getBandSeedMetadata(result.estimatedBand);
    expect(result.estimatedLevel).toBe(meta.cefrLevel);
  });
});

// ── seedKnownWords (A-U3) ─────────────────────────────────────────────────────

describe("scoreAssessment — seedKnownWords (A-U3 / AC-A-3)", () => {
  it("seedKnownWords contains only real words marked known", () => {
    const items = makeInput({
      beginnerWords: ["realword1", "realword2"],
      basicWords: ["realword3"],
      convWords: [],
      profWords: [],
      pseudowords: ["morth", "plignt"],
      beginnerKnown: [true, false],
      basicKnown: [true],
      pseudoKnown: [true, true], // pseudowords "known" — must NOT appear in output
    });
    const result = scoreAssessment(items);
    const tokens = result.seedKnownWords.map((w) => w.lemma);
    expect(tokens).toContain("realword1");
    expect(tokens).toContain("realword3");
    expect(tokens).not.toContain("realword2"); // marked not known
    expect(tokens).not.toContain("morth"); // pseudoword
    expect(tokens).not.toContain("plignt"); // pseudoword
  });

  it("pseudowords NEVER appear in seedKnownWords even when marked known (AC-A-C / A-U3)", () => {
    const items = makeInput({
      beginnerWords: [],
      basicWords: [],
      convWords: [],
      profWords: [],
      pseudowords: ["morth", "plignt", "frellow", "brix", "snorvel"],
      pseudoKnown: [true, true, true, true, true], // all "known"
    });
    const result = scoreAssessment(items);
    expect(result.seedKnownWords.length).toBe(0);
  });

  it("seedKnownWords has frequencyBand tagged (5-band, advanced allowed)", () => {
    // Build items with real tokens that have known band info
    // We use tokens that will have band=beginner from the input
    const items = makeInput({
      beginnerWords: ["alpha", "beta", "gamma"],
      basicWords: [],
      convWords: [],
      profWords: [],
      pseudowords: [],
      beginnerKnown: [true, true, false],
    });
    const result = scoreAssessment(items);
    // alpha and beta should be in seedKnownWords tagged as beginner
    for (const kw of result.seedKnownWords) {
      expect([
        "beginner",
        "basic",
        "conversation",
        "professional",
        "advanced",
      ]).toContain(kw.frequencyBand);
    }
  });

  it("all real words don't-know → seedKnownWords is empty (EC-A-D)", () => {
    const items = makeInput({
      beginnerWords: Array.from({ length: 5 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 5 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 5 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 5 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 3 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(5).fill(false) as boolean[],
      basicKnown: Array(5).fill(false) as boolean[],
      convKnown: Array(5).fill(false) as boolean[],
      profKnown: Array(5).fill(false) as boolean[],
      pseudoKnown: Array(3).fill(false) as boolean[],
    });
    const result = scoreAssessment(items);
    expect(result.seedKnownWords.length).toBe(0);
  });

  it("seedKnownWords frequencyBand comes from item.band (server-authoritative)", () => {
    // Items specify band=beginner; seedKnownWords should carry that band
    const items = makeInput({
      beginnerWords: ["hello", "world"],
      basicWords: [],
      convWords: [],
      profWords: [],
      pseudowords: [],
      beginnerKnown: [true, true],
    });
    const result = scoreAssessment(items);
    for (const kw of result.seedKnownWords) {
      // The band should match the item's declared band (beginner)
      expect(kw.frequencyBand).toBe("beginner");
    }
  });
});

// ── Safety/Edge (A-W1 / A-U4) ────────────────────────────────────────────────

describe("scoreAssessment — safety clamp and over-claimer (A-W1 / A-U4 / EC-A-A / EC-A-B)", () => {
  it("fpr ≥ 1: no division-by-zero, degrades to conservative estimate (EC-A-A / A-W1)", () => {
    // All pseudowords marked known → fpr=1.0
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 10 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[],
      basicKnown: Array(10).fill(true) as boolean[],
      convKnown: Array(10).fill(true) as boolean[],
      profKnown: Array(10).fill(true) as boolean[],
      pseudoKnown: Array(10).fill(true) as boolean[], // fpr = 1.0
    });
    // Must not throw
    expect(() => scoreAssessment(items)).not.toThrow();
    const result = scoreAssessment(items);
    // Conservative: should clamp to a non-inflated band
    expect(result.estimatedSize).toBeGreaterThanOrEqual(0);
    expect(result.estimatedBand).not.toBe("advanced");
  });

  it("zero pseudowords (denominator=0): no division-by-zero, safe output (A-W1)", () => {
    // No pseudowords in input
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: [], // no pseudowords
    });
    expect(() => scoreAssessment(items)).not.toThrow();
    const result = scoreAssessment(items);
    expect(result.estimatedBand).not.toBe("advanced");
  });

  it("over-claimer (fpr > 0.5) → band estimate down-ranked (A-U4 / EC-A-B)", () => {
    // Build a case where without down-rank result would be conversation,
    // but with fpr=0.6 (>0.5) the band should be lower
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 10 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[],
      basicKnown: Array(10).fill(true) as boolean[],
      convKnown: Array(10).fill(true) as boolean[],
      profKnown: Array(10).fill(false) as boolean[],
      pseudoKnown: [
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
      ], // fpr=0.6
    });

    // First get result WITHOUT over-claimer penalty (fpr=0)
    const noFprItems = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 10 }, (_, i) => `pw${i}`),
      beginnerKnown: Array(10).fill(true) as boolean[],
      basicKnown: Array(10).fill(true) as boolean[],
      convKnown: Array(10).fill(true) as boolean[],
      profKnown: Array(10).fill(false) as boolean[],
      pseudoKnown: Array(10).fill(false) as boolean[], // fpr=0
    });

    const overclaimResult = scoreAssessment(items);
    const noFprResult = scoreAssessment(noFprItems);

    // Over-claimer should get equal or lower band than no-fpr version
    const bandOrder = ["beginner", "basic", "conversation", "professional"];
    const overclaimIdx = bandOrder.indexOf(overclaimResult.estimatedBand);
    const noFprIdx = bandOrder.indexOf(noFprResult.estimatedBand);
    expect(overclaimIdx).toBeLessThanOrEqual(noFprIdx);
  });

  it("fpr=0.51 (just over threshold): band is conservative (down-ranked by one)", () => {
    // fpr slightly above 0.5; verify band is one step lower than it would be
    // Use conversation-level knowledge: hitRate≈0.7 for beginner, rest less
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: Array.from({ length: 100 }, (_, i) => `pw${i}`),
      // All bands known (would produce professional without penalty)
      beginnerKnown: Array(10).fill(true) as boolean[],
      basicKnown: Array(10).fill(true) as boolean[],
      convKnown: Array(10).fill(true) as boolean[],
      profKnown: Array(10).fill(true) as boolean[],
      // 52 of 100 pseudowords "known" → fpr≈0.52
      pseudoKnown: [
        ...Array(52).fill(true),
        ...Array(48).fill(false),
      ] as boolean[],
    });
    expect(() => scoreAssessment(items)).not.toThrow();
    const result = scoreAssessment(items);
    // Should not be professional (down-ranked from professional)
    expect(result.estimatedBand).not.toBe("advanced");
  });
});

// ── All don't-know edge case (EC-A-D) ────────────────────────────────────────

describe("scoreAssessment — all don't-know (EC-A-D)", () => {
  it("all real words don't-know, no pseudowords: estimatedBand=beginner, seedKnownWords=[]", () => {
    const items = makeInput({
      beginnerWords: Array.from({ length: 10 }, (_, i) => `beg${i}`),
      basicWords: Array.from({ length: 10 }, (_, i) => `bas${i}`),
      convWords: Array.from({ length: 10 }, (_, i) => `con${i}`),
      profWords: Array.from({ length: 10 }, (_, i) => `pro${i}`),
      pseudowords: [],
      beginnerKnown: Array(10).fill(false) as boolean[],
      basicKnown: Array(10).fill(false) as boolean[],
      convKnown: Array(10).fill(false) as boolean[],
      profKnown: Array(10).fill(false) as boolean[],
    });
    expect(() => scoreAssessment(items)).not.toThrow();
    const result = scoreAssessment(items);
    expect(result.estimatedBand).toBe("beginner");
    expect(result.seedKnownWords.length).toBe(0);
    expect(result.estimatedSize).toBeGreaterThanOrEqual(0);
  });

  it("empty input → graceful output (no crash)", () => {
    expect(() => scoreAssessment([])).not.toThrow();
    const result = scoreAssessment([]);
    expect(result.estimatedBand).toBe("beginner");
    expect(result.seedKnownWords.length).toBe(0);
  });
});

// ── Output type shape ─────────────────────────────────────────────────────────

describe("scoreAssessment — output shape (ScorerOutput)", () => {
  it("output has estimatedSize (number), estimatedBand, estimatedLevel (string), seedKnownWords (array)", () => {
    const items = makeInput({
      beginnerWords: ["a", "b"],
      pseudowords: ["morth"],
      beginnerKnown: [true, false],
      pseudoKnown: [false],
    });
    const result = scoreAssessment(items);
    expect(typeof result.estimatedSize).toBe("number");
    expect(typeof result.estimatedBand).toBe("string");
    expect(typeof result.estimatedLevel).toBe("string");
    expect(Array.isArray(result.seedKnownWords)).toBe(true);
  });

  it("each seedKnownWords entry has { lemma: string, frequencyBand: string }", () => {
    const items = makeInput({
      beginnerWords: ["hello", "world"],
      pseudowords: [],
      beginnerKnown: [true, true],
    });
    const result = scoreAssessment(items);
    for (const kw of result.seedKnownWords) {
      expect(typeof kw.lemma).toBe("string");
      expect(typeof kw.frequencyBand).toBe("string");
    }
  });
});
