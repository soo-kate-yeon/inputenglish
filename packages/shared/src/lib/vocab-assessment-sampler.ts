// @MX:NOTE: [AUTO] Yes/No assessment item sampler — builds the test item set for
//   the onboarding vocabulary size measurement (SPEC-INPUT-003 REQ-VOCAB-A).
//   Provides deterministic sampling via a seeded index strategy (no Math.random).
// @MX:NOTE: [AUTO] 4-band vs 5-band intent:
//   Sampler samples from all four VocabBand bands (beginner/basic/conversation/professional).
//   Item.band carries the 5-band tag (bandForLemma) for authoritative metadata.
//   Pseudowords always have band=null; they NEVER enter seedKnownWords.

import {
  assertFrequencyListLoaded,
  bandForLemma,
  lemmasInBand,
} from "./frequency-list";
import type { VocabBand } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single assessment item shown to the user.
 * - Real words: isReal=true, band=VocabBand|"advanced" (server-authoritative)
 * - Pseudowords: isReal=false, band=null
 */
export interface AssessmentItem {
  token: string;
  isReal: boolean;
  band: VocabBand | "advanced" | null;
}

/** Configuration for building a test item set. */
export interface SamplerConfig {
  /** Number of real words to sample per band (default 10). */
  wordsPerBand: number;
  /** Number of pseudowords to include (default 5). */
  pseudowordCount: number;
  /**
   * Numeric seed for deterministic sampling.
   * Same seed → identical item list (required for stable tests).
   */
  seed: number;
}

// ── Curated pseudoword list ───────────────────────────────────────────────────

/**
 * Phonotactically-plausible English-looking non-words.
 *
 * @MX:WARN: [AUTO] Pseudoword NGSL collision guard — all pseudowords must be absent
 *   from the NGSL frequency list. If the NGSL list is ever extended, re-run the
 *   collision check: `PSEUDOWORDS.forEach(pw => assert(getLemmaRank(pw) === null))`.
 * @MX:REASON: [AUTO] A pseudoword that accidentally appears in the real frequency list
 *   would corrupt the false-positive rate calculation, silently deflating estimated band
 *   for users who genuinely know the word. Verification is done at import time in tests
 *   and should also be done in any deployment check.
 */
export const PSEUDOWORDS: readonly string[] = [
  // Short (4-5 chars): common phoneme patterns, plausible but non-existent
  "morth",
  "plignt",
  "frellow",
  "brix",
  "snorvel",
  "drant",
  "gleff",
  "vemble",
  "throxe",
  "quilp",
  // Medium (5-7 chars): more word-like but clearly invented
  "wumble",
  "criven",
  "splaunt",
  "throndle",
  "blocket",
  "grumst",
  "flinder",
  "procket",
  "skemble",
  "trentive",
  // Longer (7+ chars): complex-looking, plausible derivations
  "drambulate",
  "spondrift",
  "grimentous",
  "travelsome",
  "flanderous",
  "crommulate",
  "blintering",
  "snorfulate",
  "dremmicle",
  "flornival",
];

// ── Deterministic sampling ────────────────────────────────────────────────────

/**
 * Produces a stable pseudo-random permutation of indices [0, length) using
 * a linear-congruential seed. No Math.random() — fully deterministic.
 *
 * This is intentionally simple (LCG) since the only requirement is determinism
 * for test stability, not cryptographic quality.
 */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    // LCG step: next = (a * s + c) % m with classic Knuth constants
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    // swap
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// ── Bands to sample from ──────────────────────────────────────────────────────

const SAMPLED_BANDS: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds the Yes/No assessment item set.
 *
 * Returns `(wordsPerBand × 4) + pseudowordCount` items with server-authoritative
 * `band` metadata. Sampling is deterministic for the given `seed`.
 *
 * @MX:ANCHOR: [AUTO] Assessment item builder — canonical source of test item sets.
 * @MX:REASON: [AUTO] The sampler is the sole entry point for constructing assessment
 *   items. Its contract (N real words per band, M pseudowords, deterministic seed,
 *   no NGSL collision for pseudowords) is consumed by the scorer (vocab-assessment-scorer)
 *   and the onboarding UI contract (Phase 5). Changing the output shape breaks both consumers.
 */
export function buildAssessmentItems(config: SamplerConfig): AssessmentItem[] {
  // Fatal guard: list must be loaded (F-W1)
  assertFrequencyListLoaded();

  const { wordsPerBand, pseudowordCount, seed } = config;
  const items: AssessmentItem[] = [];

  // Sample real words per band
  for (let bandIdx = 0; bandIdx < SAMPLED_BANDS.length; bandIdx++) {
    const band = SAMPLED_BANDS[bandIdx];
    const bandWords = lemmasInBand(band);

    // Use a band-specific seed offset to keep band samples independent
    const bandSeed = seed * 1000 + bandIdx;
    const shuffled = seededShuffle(bandWords, bandSeed);

    // Clamp to available words (some bands may have fewer than wordsPerBand)
    const count = Math.min(wordsPerBand, shuffled.length);

    for (let i = 0; i < count; i++) {
      const token = shuffled[i];
      items.push({
        token,
        isReal: true,
        // bandForLemma is the server-authoritative 5-band tag
        band: bandForLemma(token) ?? band,
      });
    }
  }

  // Sample pseudowords (deterministic: seeded shuffle of PSEUDOWORDS list)
  if (pseudowordCount > 0) {
    const pseudoSeed = seed * 1000 + 999; // distinct seed offset
    const shuffledPseudo = seededShuffle(PSEUDOWORDS, pseudoSeed);
    const count = Math.min(pseudowordCount, shuffledPseudo.length);
    for (let i = 0; i < count; i++) {
      items.push({
        token: shuffledPseudo[i],
        isReal: false,
        band: null,
      });
    }
  }

  return items;
}
