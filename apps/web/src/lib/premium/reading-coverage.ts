import { judgeCoverage, hasKnownWord } from "@inputenglish/shared";
import type { CoverageStatus } from "@inputenglish/shared";

// @MX:NOTE: [AUTO] Tokenizes English text into lemma tokens for coverage calculation.
// Simple split + lowercase for v1 — does not perform morphological lemmatization.
export function tokenizeText(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]{2,}\b/g) ?? [];
}

// Calculate unknown ratio given text and user's known lemma set
export function calculateUnknownRatio(
  text: string,
  knownLemmas: Set<string>,
): { unknownRatio: number; unknownWords: string[]; totalWords: number } {
  const tokens = tokenizeText(text);
  if (tokens.length === 0) {
    return { unknownRatio: 0, unknownWords: [], totalWords: 0 };
  }
  // Lemmatize surface tokens so regular inflections match the lemma-based known set.
  const unknown = tokens.filter((t) => !hasKnownWord(knownLemmas, t));
  return {
    unknownRatio: unknown.length / tokens.length,
    unknownWords: [...new Set(unknown)],
    totalWords: tokens.length,
  };
}

// Verify coverage and return status using shared judgeCoverage domain logic
export function verifyCoverage(
  text: string,
  knownLemmas: Set<string>,
): { status: CoverageStatus; unknownRatio: number; unknownWords: string[] } {
  const { unknownRatio, unknownWords } = calculateUnknownRatio(
    text,
    knownLemmas,
  );
  return { status: judgeCoverage(unknownRatio), unknownRatio, unknownWords };
}
