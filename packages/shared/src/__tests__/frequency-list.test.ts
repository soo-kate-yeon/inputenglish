/**
 * RED phase: Tests for packages/shared/src/lib/frequency-list.ts
 *
 * SPEC-INPUT-003 REQ-VOCAB-F — Frequency list foundation.
 * All tests written BEFORE implementation (TDD discipline).
 *
 * Test plan:
 *  - bandForRank: boundary conditions (500→beginner, 501→basic, etc.)
 *  - getLemmaRank: known word returns 1-based rank, unknown returns null
 *  - bandForLemma: delegates to getLemmaRank + bandForRank
 *  - lemmasInBand: non-cumulative single-band membership
 *  - cumulativeKnownSet: cumulative containment (professional ⊇ conversation ⊇ basic ⊇ beginner)
 *  - assertFrequencyListLoaded: throws on empty list
 */

import { describe, expect, it } from "vitest";
import {
  getLemmaRank,
  bandForRank,
  bandForLemma,
  lemmasInBand,
  cumulativeKnownSet,
  assertFrequencyListLoaded,
} from "../lib/frequency-list";

// ── bandForRank ──────────────────────────────────────────────────────────────

describe("bandForRank — boundary conditions (AC-F-2 / EC-F-D)", () => {
  it("rank 1 → beginner", () => {
    expect(bandForRank(1)).toBe("beginner");
  });

  it("rank 500 → beginner (upper boundary)", () => {
    expect(bandForRank(500)).toBe("beginner");
  });

  it("rank 501 → basic (crosses boundary)", () => {
    expect(bandForRank(501)).toBe("basic");
  });

  it("rank 1000 → basic (mid-range)", () => {
    expect(bandForRank(1000)).toBe("basic");
  });

  it("rank 1500 → basic (upper boundary)", () => {
    expect(bandForRank(1500)).toBe("basic");
  });

  it("rank 1501 → conversation (crosses boundary)", () => {
    expect(bandForRank(1501)).toBe("conversation");
  });

  it("rank 2000 → conversation (mid-range)", () => {
    expect(bandForRank(2000)).toBe("conversation");
  });

  it("rank 3000 → conversation (upper boundary)", () => {
    expect(bandForRank(3000)).toBe("conversation");
  });

  it("rank 3001 → professional (crosses boundary)", () => {
    expect(bandForRank(3001)).toBe("professional");
  });

  it("rank 5000 → professional (mid-range)", () => {
    expect(bandForRank(5000)).toBe("professional");
  });

  it("rank 6000 → professional (upper boundary)", () => {
    expect(bandForRank(6000)).toBe("professional");
  });

  it("rank 6001 → advanced (crosses into advanced)", () => {
    expect(bandForRank(6001)).toBe("advanced");
  });

  it("rank 9999 → advanced (deep in advanced)", () => {
    expect(bandForRank(9999)).toBe("advanced");
  });
});

// ── getLemmaRank ─────────────────────────────────────────────────────────────

describe("getLemmaRank — known / unknown lemmas", () => {
  it("'the' has rank 1 (most frequent)", () => {
    expect(getLemmaRank("the")).toBe(1);
  });

  it("lookup is case-insensitive (THE → 1)", () => {
    expect(getLemmaRank("THE")).toBe(1);
  });

  it("lookup is case-insensitive (The → 1)", () => {
    expect(getLemmaRank("The")).toBe(1);
  });

  it("returns null for a made-up word not in the list", () => {
    expect(getLemmaRank("zzzyyyxxx_not_a_word")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getLemmaRank("")).toBeNull();
  });

  it("'be' has rank 2", () => {
    expect(getLemmaRank("be")).toBe(2);
  });

  it("returns a number ≥ 1 for any known word", () => {
    const rank = getLemmaRank("and");
    expect(rank).not.toBeNull();
    expect(rank!).toBeGreaterThanOrEqual(1);
  });
});

// ── bandForLemma ─────────────────────────────────────────────────────────────

describe("bandForLemma", () => {
  it("'the' is in beginner band", () => {
    expect(bandForLemma("the")).toBe("beginner");
  });

  it("returns null for a word not in the list", () => {
    expect(bandForLemma("zzzyyyxxx_not_a_word")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(bandForLemma("THE")).toBe("beginner");
  });
});

// ── lemmasInBand ─────────────────────────────────────────────────────────────

describe("lemmasInBand — non-cumulative single-band slices", () => {
  it("beginner band has exactly 500 lemmas", () => {
    expect(lemmasInBand("beginner").length).toBe(500);
  });

  it("basic band has exactly 1000 lemmas (rank 501-1500)", () => {
    expect(lemmasInBand("basic").length).toBe(1000);
  });

  it("conversation band has exactly 1500 lemmas (rank 1501-3000)", () => {
    expect(lemmasInBand("conversation").length).toBe(1500);
  });

  it("professional band has 807 lemmas (rank 3001-3807; list ends at 3807)", () => {
    // NGSL list has 3807 total: professional slice is 3001..3807 = 807 words
    expect(lemmasInBand("professional").length).toBe(807);
  });

  it("advanced band is empty (list does not extend past 3807)", () => {
    expect(lemmasInBand("advanced").length).toBe(0);
  });

  it("beginner band contains 'the'", () => {
    expect(lemmasInBand("beginner")).toContain("the");
  });

  it("basic band does NOT contain 'the' (non-cumulative)", () => {
    expect(lemmasInBand("basic")).not.toContain("the");
  });
});

// ── cumulativeKnownSet ───────────────────────────────────────────────────────

describe("cumulativeKnownSet — cumulative containment (AC-F / EC-F-A)", () => {
  it("beginner set contains 500 words", () => {
    expect(cumulativeKnownSet("beginner").size).toBe(500);
  });

  it("basic set contains 1500 words (cumulative from rank 1)", () => {
    expect(cumulativeKnownSet("basic").size).toBe(1500);
  });

  it("conversation set contains 3000 words", () => {
    expect(cumulativeKnownSet("conversation").size).toBe(3000);
  });

  it("professional set contains 3807 words (all available lemmas)", () => {
    // professional ceiling is 6000 but list only has 3807
    expect(cumulativeKnownSet("professional").size).toBe(3807);
  });

  it("professional ⊇ conversation (cumulative monotonicity)", () => {
    const prof = cumulativeKnownSet("professional");
    const conv = cumulativeKnownSet("conversation");
    for (const w of conv) {
      expect(prof.has(w)).toBe(true);
    }
  });

  it("conversation ⊇ basic (cumulative monotonicity)", () => {
    const conv = cumulativeKnownSet("conversation");
    const basic = cumulativeKnownSet("basic");
    for (const w of basic) {
      expect(conv.has(w)).toBe(true);
    }
  });

  it("basic ⊇ beginner (cumulative monotonicity)", () => {
    const basic = cumulativeKnownSet("basic");
    const beg = cumulativeKnownSet("beginner");
    for (const w of beg) {
      expect(basic.has(w)).toBe(true);
    }
  });

  it("beginner set contains 'the'", () => {
    expect(cumulativeKnownSet("beginner").has("the")).toBe(true);
  });
});

// ── assertFrequencyListLoaded — load-failure fatal (F-W1) ───────────────────

describe("assertFrequencyListLoaded — F-W1 load-failure fatal guard", () => {
  it("does not throw when the frequency list is loaded (non-empty)", () => {
    // The real list has 3807 entries; this should not throw.
    expect(() => assertFrequencyListLoaded()).not.toThrow();
  });
});
