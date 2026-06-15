import type { VocabBand } from "../types";

// Frequency bands: words a learner at this band "knows" covers from most-frequent down
// to approximately this band's ceiling. Based on nation-2001 BNC frequency lists.
// i+1 target: 2-5% unknown -> generate content one band above current seed.
export const BAND_WORD_COUNTS: Record<VocabBand, number> = {
  beginner: 500, // ~BNC 1-500 most frequent
  basic: 1500, // ~BNC 501-1500
  conversation: 3000, // ~BNC 1501-3000
  professional: 6000, // ~BNC 3001-6000
};

// Words known at each band level (cumulative from most-frequent)
// Beginner knows words 1-500, basic knows 1-1500, etc.
export function getKnownWordCountForBand(band: VocabBand): number {
  return BAND_WORD_COUNTS[band];
}

// Generate seed known-word entries for a band (returns lemmas up to band ceiling)
// In production, lemmas come from a frequency-ranked word list.
// For v1 vertical slice: returns band metadata; actual lemma population is deferred.
export function getBandSeedMetadata(band: VocabBand): {
  band: VocabBand;
  estimatedWordCount: number;
  cefrLevel: string;
} {
  const cefrMap: Record<VocabBand, string> = {
    beginner: "A1",
    basic: "A2",
    conversation: "B1",
    professional: "B2",
  };
  return {
    band,
    estimatedWordCount: BAND_WORD_COUNTS[band],
    cefrLevel: cefrMap[band],
  };
}

// Coverage judgment: is unknown-word ratio within target (2-5%)?
export type CoverageStatus = "too-easy" | "optimal" | "too-hard";

export function judgeCoverage(unknownRatio: number): CoverageStatus {
  if (unknownRatio < 0.02) return "too-easy";
  if (unknownRatio > 0.05) return "too-hard";
  return "optimal";
}

// Difficulty direction: given current ratio, should next content be easier or harder?
export function coverageDifficultyAdjustment(unknownRatio: number): -1 | 0 | 1 {
  const status = judgeCoverage(unknownRatio);
  if (status === "too-hard") return -1; // lower difficulty
  if (status === "too-easy") return 1; // raise difficulty
  return 0;
}
