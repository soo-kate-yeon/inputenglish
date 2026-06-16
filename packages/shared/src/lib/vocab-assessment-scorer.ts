// @MX:ANCHOR: [AUTO] Yes/No vocabulary assessment scorer — canonical scoring contract.
// @MX:REASON: [AUTO] This function is the single authoritative implementation of the
//   false-positive-corrected vocabulary size estimation (REQ-VOCAB-A-U1). It produces
//   both the estimated_band (4-band, clamped to professional) and the seed known_words
//   (5-band, advanced allowed). Any change to the scoring formula or band-mapping contract
//   must be reflected here first. Consumers: vocab-assessment-sampler (item metadata),
//   Phase 2 Persist writer, and the onboarding UI contract (Phase 5).
//
// @MX:NOTE: [AUTO] 4-band vs 5-band intent:
//   - estimatedBand (output field): 4-band, CLAMPED to professional. "advanced" NEVER emitted.
//     Reason: user_vocab_profiles.estimated_band has a 4-band CHECK constraint.
//   - seedKnownWords[].frequencyBand: 5-band (advanced allowed).
//     Reason: known_words.frequency_band has a 5-band CHECK; advanced tagging preserves
//     per-word precision for users whose vocabulary extends beyond the NGSL professional range.
//
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-A (A-U1, A-U2, A-U3, A-W1, A-U4)

import { assertFrequencyListLoaded } from "./frequency-list";
import { getBandSeedMetadata } from "./vocab-band";
import type { VocabBand } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single answered item: real word or pseudoword, with authoritative band metadata
 * supplied by the server (from the sampler / frequency list), plus the user's answer.
 */
export interface ScorerInput {
  token: string;
  /** true = real word from frequency list; false = pseudoword */
  isReal: boolean;
  /**
   * Server-authoritative band for real words (from bandForLemma).
   * null for pseudowords.
   */
  band: VocabBand | "advanced" | null;
  /** User's answer: true = "I know this word" */
  known: boolean;
}

/** A seed known-word entry produced by the scorer. */
export interface SeedKnownWord {
  lemma: string;
  /**
   * 5-band frequency tag (advanced allowed) from the item's authoritative band.
   * Feeds known_words.frequency_band (5-band CHECK constraint).
   */
  frequencyBand: VocabBand | "advanced";
}

/** Scoring result (REQ-VOCAB-A output contract). */
export interface ScorerOutput {
  /** Estimated vocabulary size (continuous, in words). */
  estimatedSize: number;
  /**
   * Estimated band (4-band, professional clamp).
   * NEVER "advanced" — user_vocab_profiles.estimated_band has 4-band CHECK.
   */
  estimatedBand: VocabBand;
  /** CEFR level string from getBandSeedMetadata(estimatedBand). */
  estimatedLevel: string;
  /**
   * Real words the user marked "known", with 5-band frequency tags.
   * Pseudowords are NEVER included (A-U3 / P-U2).
   */
  seedKnownWords: SeedKnownWord[];
}

// ── Band configuration ────────────────────────────────────────────────────────

/**
 * Band widths (word counts) — BAND_WORD_COUNTS successive differences.
 *
 * beginner:     500  (rank    1–500)
 * basic:       1000  (rank  501–1500)
 * conversation:1500  (rank 1501–3000)
 * professional:3000  (rank 3001–6000)
 */
const BAND_WIDTHS: Record<VocabBand, number> = {
  beginner: 500,
  basic: 1000,
  conversation: 1500,
  professional: 3000,
};

/** Ordered from least to most advanced — used for size-to-band mapping. */
const BAND_ORDER: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

/**
 * Cumulative lower bounds for each band (= sum of widths of all preceding bands).
 * A size within [cumulativeLow, cumulativeLow + width) maps to the corresponding band.
 */
const BAND_CUMULATIVE_LOW: Record<VocabBand, number> = {
  beginner: 0,
  basic: 500,
  conversation: 1500,
  professional: 3000,
};

// ── Over-claimer threshold ────────────────────────────────────────────────────

/**
 * False-positive rate threshold above which the user is deemed an "over-claimer".
 * When fpr > OVERCLAIM_THRESHOLD, the band estimate is down-ranked by one step (A-U4).
 */
const OVERCLAIM_THRESHOLD = 0.5;

// ── Band mapping ──────────────────────────────────────────────────────────────

/**
 * Maps an estimated vocabulary size to a 4-band VocabBand.
 *
 * - size < 500  → beginner
 * - 500 ≤ size < 1500 → basic
 * - 1500 ≤ size < 3000 → conversation
 * - size ≥ 3000 → professional
 *
 * NEVER returns "advanced" (A-U2).
 */
function bandForSize(size: number): VocabBand {
  if (size < BAND_CUMULATIVE_LOW.basic) return "beginner";
  if (size < BAND_CUMULATIVE_LOW.conversation) return "basic";
  if (size < BAND_CUMULATIVE_LOW.professional) return "conversation";
  return "professional"; // clamp: sizes ≥ 3000 → professional (never advanced)
}

/**
 * Down-ranks a VocabBand by one step (clamps at beginner).
 *
 * professional → conversation → basic → beginner (floor)
 */
function downRankBand(band: VocabBand): VocabBand {
  const idx = BAND_ORDER.indexOf(band);
  return BAND_ORDER[Math.max(0, idx - 1)];
}

// ── Scorer ────────────────────────────────────────────────────────────────────

/**
 * Scores a Yes/No vocabulary assessment with false-positive correction.
 *
 * @MX:ANCHOR: [AUTO] Canonical scoring contract (REQ-VOCAB-A-U1).
 * @MX:REASON: [AUTO] Single authoritative entry point for vocabulary size estimation.
 *   Implements the exact formula from plan §4.2:
 *     hitRate_b        = (real words in band b marked known) / (real words in band b)
 *     falsePositiveRate = (pseudowords marked known) / (pseudowords total)
 *     correctedFrac_b  = max(0, (hitRate_b − fpr) / (1 − fpr))
 *     estimatedSize    = Σ_b (correctedFrac_b × width_b)
 *     estimatedBand    = bandForSize(estimatedSize), clamped to professional
 *     estimatedLevel   = getBandSeedMetadata(estimatedBand).cefrLevel
 *     seedKnownWords   = real words the user marked known → { lemma, frequencyBand }
 *
 * Safety contracts:
 *   - fpr ≥ 1 → safe clamp, no division-by-zero (A-W1)
 *   - zero pseudowords → fpr treated as 0 (A-W1)
 *   - fpr > 0.5 (over-claimer) → band down-ranked by one step (A-U4)
 *   - Pseudowords NEVER in seedKnownWords (A-U3)
 *
 * @param items - Array of answered assessment items (real words + pseudowords)
 * @returns Scoring output: estimatedSize, estimatedBand, estimatedLevel, seedKnownWords
 */
export function scoreAssessment(items: ScorerInput[]): ScorerOutput {
  // Fatal guard: frequency list must be loaded (F-W1)
  // Note: scorer itself doesn't use the list, but callers depend on it being
  // loaded to supply authoritative band metadata in item.band.
  // We call the guard here to surface load failures early.
  _assertFrequencyListLoaded();

  // ── Step 1: Partition into real words (per band) and pseudowords ─────────

  const bandItems: Record<VocabBand, ScorerInput[]> = {
    beginner: [],
    basic: [],
    conversation: [],
    professional: [],
  };
  const pseudoItems: ScorerInput[] = [];

  for (const item of items) {
    if (!item.isReal) {
      pseudoItems.push(item);
    } else if (item.band !== null && item.band !== "advanced") {
      // Real words with a 4-band tag go into their band bucket
      bandItems[item.band].push(item);
    } else if (item.band === "advanced") {
      // Real words tagged "advanced" don't map to any test band for scoring
      // but do contribute to seedKnownWords (A-U3 — advanced allowed there)
      // They are excluded from hitRate calculations (no band width defined).
    }
    // isReal=true with band=null shouldn't occur; skip silently.
  }

  // ── Step 2: Compute false-positive rate ──────────────────────────────────

  // @MX:WARN: [AUTO] False-positive correction branch — three safety cases.
  // @MX:REASON: [AUTO] Division-by-zero and over-clamping can silently produce invalid
  //   band estimates. Case 1 (zero pseudowords): treat fpr=0 (no correction, conservative).
  //   Case 2 (fpr≥1): all pseudowords marked known; treat fpr=0.999 so correctedFrac→0
  //   for all bands (maximally conservative). Case 3 (fpr>0.5, over-claimer): standard
  //   correction + band down-rank. (A-W1 / A-U4)
  const pseudoTotal = pseudoItems.length;
  const pseudoKnown = pseudoItems.filter((i) => i.known).length;

  let fpr: number;
  if (pseudoTotal === 0) {
    // No pseudowords: cannot compute fpr; treat as 0 (no correction applied)
    fpr = 0;
  } else {
    fpr = pseudoKnown / pseudoTotal;
  }

  // Clamp fpr to [0, 0.999] to prevent 1/(1-fpr) division-by-zero (A-W1)
  const fprClamped = Math.min(fpr, 0.999);

  // ── Step 3: Compute corrected fraction per band and accumulate size ───────

  let estimatedSize = 0;

  for (const band of BAND_ORDER) {
    const bandWords = bandItems[band];
    const bandTotal = bandWords.length;
    if (bandTotal === 0) continue;

    const bandKnown = bandWords.filter((i) => i.known).length;
    const hitRate = bandKnown / bandTotal;

    // correctedFrac = max(0, (hitRate - fpr) / (1 - fpr))
    const correctedFrac = Math.max(
      0,
      (hitRate - fprClamped) / (1 - fprClamped),
    );
    estimatedSize += correctedFrac * BAND_WIDTHS[band];
  }

  // ── Step 4: Map to 4-band (professional clamp, never "advanced") ──────────

  let estimatedBand: VocabBand = bandForSize(estimatedSize);

  // Over-claimer down-rank (A-U4): fpr > 0.5 → down-rank by one step
  if (fpr > OVERCLAIM_THRESHOLD) {
    estimatedBand = downRankBand(estimatedBand);
  }

  // ── Step 5: CEFR level (A-U2) ────────────────────────────────────────────

  const estimatedLevel = getBandSeedMetadata(estimatedBand).cefrLevel;

  // ── Step 6: Seed known-words (A-U3 — real words only, pseudowords NEVER) ──

  const seedKnownWords: SeedKnownWord[] = [];

  for (const item of items) {
    // Pseudowords are ABSOLUTELY excluded (A-U3 / P-U2)
    if (!item.isReal) continue;
    if (!item.known) continue;
    if (item.band === null) continue;

    seedKnownWords.push({
      lemma: item.token,
      // 5-band tag from authoritative server metadata (advanced allowed here)
      frequencyBand: item.band,
    });
  }

  return {
    estimatedSize,
    estimatedBand,
    estimatedLevel,
    seedKnownWords,
  };
}

// ── Internal guard alias ──────────────────────────────────────────────────────

/**
 * Calls assertFrequencyListLoaded() from frequency-list.ts.
 *
 * The scorer itself uses bandForSize (pure math) and getBandSeedMetadata
 * (from vocab-band.ts), not the raw frequency list directly. However, the
 * SPEC requires assertFrequencyListLoaded() to be called at scorer entry
 * (plan §4: "call assertFrequencyListLoaded() at the sampler/scorer entry").
 *
 * Callers supply item.band from the frequency list loader; we validate the
 * list is present before processing answers.
 */
function _assertFrequencyListLoaded(): void {
  assertFrequencyListLoaded();
}
