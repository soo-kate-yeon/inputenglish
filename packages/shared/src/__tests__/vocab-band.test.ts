// RED phase: Tests written before implementation
// These tests define the expected behavior of vocab-band.ts
import {
  judgeCoverage,
  coverageDifficultyAdjustment,
  getBandSeedMetadata,
  getKnownWordCountForBand,
  BAND_WORD_COUNTS,
} from "../lib/vocab-band";

describe("judgeCoverage", () => {
  it("returns too-easy when unknown ratio is below 2%", () => {
    expect(judgeCoverage(0.01)).toBe("too-easy");
  });

  it("returns optimal when unknown ratio is within 2-5%", () => {
    expect(judgeCoverage(0.03)).toBe("optimal");
  });

  it("returns too-hard when unknown ratio is above 5%", () => {
    expect(judgeCoverage(0.12)).toBe("too-hard");
  });

  it("returns too-easy for exactly 0", () => {
    expect(judgeCoverage(0)).toBe("too-easy");
  });

  it("returns optimal at exactly 2%", () => {
    expect(judgeCoverage(0.02)).toBe("optimal");
  });

  it("returns optimal at exactly 5%", () => {
    expect(judgeCoverage(0.05)).toBe("optimal");
  });

  it("returns too-hard just above 5%", () => {
    expect(judgeCoverage(0.051)).toBe("too-hard");
  });
});

describe("coverageDifficultyAdjustment", () => {
  it("returns -1 when content is too hard (0.12 unknown ratio)", () => {
    expect(coverageDifficultyAdjustment(0.12)).toBe(-1);
  });

  it("returns 1 when content is too easy (0 unknown ratio)", () => {
    expect(coverageDifficultyAdjustment(0)).toBe(1);
  });

  it("returns 0 when content is at optimal difficulty", () => {
    expect(coverageDifficultyAdjustment(0.03)).toBe(0);
  });
});

describe("getBandSeedMetadata", () => {
  it("returns B1 CEFR level for conversation band", () => {
    expect(getBandSeedMetadata("conversation").cefrLevel).toBe("B1");
  });

  it("returns A1 CEFR level for beginner band", () => {
    expect(getBandSeedMetadata("beginner").cefrLevel).toBe("A1");
  });

  it("returns A2 CEFR level for basic band", () => {
    expect(getBandSeedMetadata("basic").cefrLevel).toBe("A2");
  });

  it("returns B2 CEFR level for professional band", () => {
    expect(getBandSeedMetadata("professional").cefrLevel).toBe("B2");
  });

  it("returns correct estimated word count for conversation band", () => {
    expect(getBandSeedMetadata("conversation").estimatedWordCount).toBe(3000);
  });

  it("returns the band name in the result", () => {
    expect(getBandSeedMetadata("basic").band).toBe("basic");
  });
});

describe("getKnownWordCountForBand", () => {
  it("returns 500 for beginner band", () => {
    expect(getKnownWordCountForBand("beginner")).toBe(500);
  });

  it("returns 1500 for basic band", () => {
    expect(getKnownWordCountForBand("basic")).toBe(1500);
  });

  it("returns 3000 for conversation band", () => {
    expect(getKnownWordCountForBand("conversation")).toBe(3000);
  });

  it("returns 6000 for professional band", () => {
    expect(getKnownWordCountForBand("professional")).toBe(6000);
  });
});

describe("BAND_WORD_COUNTS", () => {
  it("has cumulative counts from most frequent", () => {
    expect(BAND_WORD_COUNTS.beginner).toBeLessThan(BAND_WORD_COUNTS.basic);
    expect(BAND_WORD_COUNTS.basic).toBeLessThan(BAND_WORD_COUNTS.conversation);
    expect(BAND_WORD_COUNTS.conversation).toBeLessThan(
      BAND_WORD_COUNTS.professional,
    );
  });
});
