/**
 * @MX:NOTE: [AUTO] Listening-specific difficulty gate — reuses the shared
 *   band-coverage scoring primitive (computeBandCoverage / bandCoverage record)
 *   already produced by band-coverage.ts, applying a STRICTER unknown-word-ratio
 *   ceiling than reading's POOL_MAX_UNKNOWN_RATIO (0.2 / ~80% coverage).
 * @MX:SPEC: SPEC-WEB-001 Phase 4 REQ-WEB-003-E1, AC-003-3
 *
 * Derivation of LISTENING_MAX_UNKNOWN_RATIO (implementation_divergence note):
 * AC-003-3 states a segment at 96% coverage (4% unknown) passes reading's bar
 * but must fail listening's bar, and spec.md/plan.md describe the listening
 * threshold as "≈98-99% coverage OR a lower wpm requirement". This module
 * implements the coverage-ceiling path (not the alternative lower-wpm path,
 * which remains available separately via scoreSegmentDifficulty's wpm axis in
 * segment-scorer.ts). 0.02 (98% coverage) is chosen as the concrete constant:
 * it sits at the stricter end of the "~98-99%" range stated in the spec, and
 * is provably smaller than POOL_MAX_UNKNOWN_RATIO (0.2), satisfying both the
 * "stricter than reading" invariant and the AC-003-3 96%-coverage-fails case
 * (unknown ratio 0.04 > 0.02).
 */
import type { VocabBand } from "@inputenglish/shared";

/**
 * Listening's unknown-word-ratio ceiling (~98% coverage). Must always remain
 * stricter (smaller) than reading's POOL_MAX_UNKNOWN_RATIO — see reading-batch.ts.
 */
export const LISTENING_MAX_UNKNOWN_RATIO = 0.02;

export interface ListeningGateInput {
  /** Per-band coverage ratios, as produced by computeBandCoverage() in band-coverage.ts. */
  bandCoverage: Record<string, number>;
  /** The band to evaluate the gate against. */
  band: VocabBand;
}

export interface ListeningGateResult {
  unknownRatio: number;
  passes: boolean;
}

/**
 * Evaluates the listening difficulty gate for a segment given its band coverage.
 *
 * Reuses the same coverage record shape produced by computeBandCoverage()
 * (band-coverage.ts) — this function performs no independent word-coverage
 * computation of its own.
 */
export function evaluateListeningGate(
  input: ListeningGateInput,
): ListeningGateResult {
  const coverage = input.bandCoverage[input.band] ?? 0;
  const unknownRatio = Math.max(0, 1 - coverage);

  return {
    unknownRatio,
    passes: unknownRatio <= LISTENING_MAX_UNKNOWN_RATIO,
  };
}
