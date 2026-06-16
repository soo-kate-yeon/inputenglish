// @MX:NOTE: [AUTO] Frequency-list loader — single source for band partitioning and coverage.
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-F
// @MX:NOTE: [AUTO] Band partition rule (F-U2):
//   beginner  = rank   1–500     (500 words)
//   basic     = rank 501–1500   (1000 words)
//   conversation = rank 1501–3000 (1500 words)
//   professional = rank 3001–6000 (3000 words)
//   advanced  = rank 6001+       (0 in this CC list — v1 limitation)
// @MX:NOTE: [AUTO] 4-band vs 5-band intent:
//   VocabBand (4-band): beginner|basic|conversation|professional — used for estimated_band, band coverage.
//   "advanced" (5th): exists ONLY for known_words.frequency_band tagging and bandForRank().
//   estimated_band MUST be clamped to professional (never "advanced").
// @MX:NOTE: [AUTO] CC BY-SA 4.0 source: NGSL 1.01 + NAWL by Browne, Culligan & Phillips.
//   Derivative ordering is distributed under the same CC BY-SA 4.0 license. Attribution required.

import { NGSL_FREQUENCY_RANKED } from "../data/ngsl-frequency";
import type { VocabBand } from "../types";

// ── Internal rank map (built once, O(1) lookup) ───────────────────────────────

// @MX:ANCHOR: [AUTO] Rank map — single O(1) lookup table for all frequency queries.
// @MX:REASON: [AUTO] All consumers (getLemmaRank, bandForLemma, cumulativeKnownSet) depend on
//   this map. Rebuilding it would break invariant that rank 1 = index 0 = most frequent.
const _rankMap: Map<string, number> = new Map();

(function buildRankMap() {
  for (let i = 0; i < NGSL_FREQUENCY_RANKED.length; i++) {
    // Store lowercase for case-insensitive lookup; rank is 1-based
    _rankMap.set(NGSL_FREQUENCY_RANKED[i].toLowerCase(), i + 1);
  }
})();

// ── Band boundary constants ───────────────────────────────────────────────────

const BEGINNER_CEILING = 500;
const BASIC_CEILING = 1500;
const CONVERSATION_CEILING = 3000;
const PROFESSIONAL_CEILING = 6000;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the 1-based frequency rank for the given lemma (case-insensitive),
 * or null if the lemma is not in the canonical list.
 *
 * Rank 1 = most frequent word ("the").
 */
export function getLemmaRank(lemma: string): number | null {
  if (!lemma) return null;
  const rank = _rankMap.get(lemma.toLowerCase());
  return rank !== undefined ? rank : null;
}

/**
 * Maps a 1-based frequency rank to a band.
 *
 * Returns "advanced" for rank > 6000 (5-band result; feeds known_words tagging).
 * VocabBand (4-band) consumers must clamp "advanced" to "professional" themselves.
 */
export function bandForRank(rank: number): VocabBand | "advanced" {
  if (rank <= BEGINNER_CEILING) return "beginner";
  if (rank <= BASIC_CEILING) return "basic";
  if (rank <= CONVERSATION_CEILING) return "conversation";
  if (rank <= PROFESSIONAL_CEILING) return "professional";
  return "advanced";
}

/**
 * Returns the band for a lemma (case-insensitive), or null if not in the list.
 *
 * Returns 5-band result including "advanced" for rank > 6000.
 */
export function bandForLemma(lemma: string): VocabBand | "advanced" | null {
  const rank = getLemmaRank(lemma);
  if (rank === null) return null;
  return bandForRank(rank);
}

/**
 * Returns all lemmas (non-cumulative) whose rank falls within the given band's range.
 *
 * - beginner:     rank   1–500
 * - basic:        rank 501–1500
 * - conversation: rank 1501–3000
 * - professional: rank 3001–6000
 * - advanced:     rank 6001+ (empty in this CC list — v1 limitation)
 */
export function lemmasInBand(band: VocabBand | "advanced"): string[] {
  let low: number;
  let high: number;

  switch (band) {
    case "beginner":
      low = 1;
      high = BEGINNER_CEILING;
      break;
    case "basic":
      low = BEGINNER_CEILING + 1;
      high = BASIC_CEILING;
      break;
    case "conversation":
      low = BASIC_CEILING + 1;
      high = CONVERSATION_CEILING;
      break;
    case "professional":
      low = CONVERSATION_CEILING + 1;
      high = PROFESSIONAL_CEILING;
      break;
    case "advanced":
      low = PROFESSIONAL_CEILING + 1;
      high = Infinity;
      break;
  }

  const result: string[] = [];
  for (let i = low - 1; i < NGSL_FREQUENCY_RANKED.length && i < high; i++) {
    result.push(NGSL_FREQUENCY_RANKED[i]);
  }
  return result;
}

/**
 * Returns a Set of all lemmas at or below the band's ceiling (cumulative).
 *
 * Used as the backend for computeBandCoverage() (F-U3):
 *   professional ⊇ conversation ⊇ basic ⊇ beginner
 *
 * @MX:ANCHOR: [AUTO] Cumulative known-set — all coverage consumers depend on this invariant.
 * @MX:REASON: [AUTO] computeBandCoverage() in band-coverage.ts requires cumulative semantics
 *   (each higher band's set is a strict superset of all lower bands). Breaking this would
 *   corrupt session-assembly band matching in SPEC-INPUT-002.
 */
export function cumulativeKnownSet(band: VocabBand): Set<string> {
  const ceiling = bandCeiling(band);
  const set = new Set<string>();
  for (let i = 0; i < NGSL_FREQUENCY_RANKED.length && i < ceiling; i++) {
    set.add(NGSL_FREQUENCY_RANKED[i]);
  }
  return set;
}

/** Returns the cumulative word-count ceiling for a VocabBand. */
function bandCeiling(band: VocabBand): number {
  switch (band) {
    case "beginner":
      return BEGINNER_CEILING;
    case "basic":
      return BASIC_CEILING;
    case "conversation":
      return CONVERSATION_CEILING;
    case "professional":
      return PROFESSIONAL_CEILING;
  }
}

// ── Load-failure fatal guard (F-W1) ──────────────────────────────────────────

/**
 * Throws if the canonical frequency list failed to load (empty array).
 *
 * Assessment paths MUST call this guard before sampling or scoring.
 * Never silently fall back to incomplete data.
 *
 * @MX:WARN: [AUTO] Fatal guard — must throw loudly on empty list.
 * @MX:REASON: [AUTO] Silent fallback to hand-seeded partial sets would corrupt band estimates
 *   (F-W1). A failed load must surface immediately so callers can handle it explicitly
 *   rather than producing misleading vocabulary assessments.
 */
export function assertFrequencyListLoaded(): void {
  if (NGSL_FREQUENCY_RANKED.length === 0) {
    throw new Error(
      "[SPEC-INPUT-003 F-W1] Canonical frequency list failed to load. " +
        "Assessment path cannot proceed with empty word list — " +
        "silent fallback to hand-seeded sets would corrupt band estimates.",
    );
  }
}
