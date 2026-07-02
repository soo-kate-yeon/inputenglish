// @MX:ANCHOR: [AUTO] IL Tap-Rate Micro-Adjustment — Task 3.4 runtime nudge adapter.
// @MX:REASON: [AUTO] Reuses the domain-agnostic vote-counting primitive
//   (countHysteresisVote, vocab-band-hysteresis.ts) so that instead of flipping a
//   discrete VocabBand, this nudges a CONTINUOUS il_index by +-IL_TAP_STEP once K
//   consecutive same-direction votes accumulate. countHysteresisVote was extracted
//   from applyHysteresisVote specifically so this module never needs a synthetic
//   band value to drive the counting logic — it calls the same reset/continuation/
//   K-trigger rules directly. tapRateToVote() reuses coverageDifficultyAdjustment()
//   (the same 2-5% target-band judgment vocab-refine.ts uses for the discrete path).
//   A trigger is translated into a +-IL_TAP_STEP il_index nudge, clamped to the
//   [1.0, 7.0] invariant via clampIlIndex.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002-W1 (AC-002-3)

import {
  coverageDifficultyAdjustment,
  countHysteresisVote,
  type VoteState,
} from "@inputenglish/shared";
import { clampIlIndex } from "./il-onboarding-repository";

/** The IL nudge increment applied on each hysteresis-gated trigger (AC-002-3). */
export const IL_TAP_STEP = 0.1;

/**
 * Converts a measured unknown-word tap rate into a directional vote.
 *
 * Delegates to coverageDifficultyAdjustment() — the SAME 2-5% target-band judgment
 * vocab-refine.ts already uses for the discrete-band Refine loop (REQ-VOCAB-R-E1).
 * No threshold logic is duplicated here.
 */
export function tapRateToVote(tapRate: number): -1 | 0 | 1 {
  return coverageDifficultyAdjustment(tapRate);
}

export interface AdjustIlFromTapRateParams {
  /** The user's current il_index. */
  currentIl: number;
  /** Measured unknown-word tap rate for the session (0-1 fraction). */
  tapRate: number;
  /** Running vote state (from the previous call, or {direction:0, count:0} initially). */
  voteState: VoteState;
  /** Hysteresis K (consecutive votes required). Default: 3 (matches the discrete path). */
  k?: number;
}

export interface AdjustIlFromTapRateResult {
  /** The il_index after applying this signal (= currentIl if not nudged). */
  newIl: number;
  /** Updated vote state to persist/pass to next call. */
  newVoteState: VoteState;
  /** True if il_index was nudged in this call. */
  nudged: boolean;
  /** The direction vote computed from this tap rate: -1 | 0 | +1. */
  directionVote: -1 | 0 | 1;
}

/**
 * Applies a single tap-rate signal to the running vote state and nudges il_index
 * by +-IL_TAP_STEP once K consecutive same-direction votes accumulate.
 *
 * @MX:ANCHOR: [AUTO] Runtime IL micro-adjustment — single entry point for tap-rate -> il_index nudge.
 * @MX:REASON: [AUTO] Reuses countHysteresisVote's K-consecutive-vote/reset/trigger semantics
 *   directly (no synthetic band value needed) — the exact same reset-on-direction-change,
 *   reset-on-zero-vote, and K-consecutive-trigger rules apply here as they do for the discrete
 *   VocabBand path in applyHysteresisVote, just with a +-IL_TAP_STEP float nudge as the "trigger
 *   payload" instead of a band swap. Clamps the result to [1.0, 7.0] via clampIlIndex.
 */
export function adjustIlFromTapRate(
  params: AdjustIlFromTapRateParams,
): AdjustIlFromTapRateResult {
  const { currentIl, tapRate, voteState, k = 3 } = params;

  const directionVote = tapRateToVote(tapRate);
  const { voteState: newVoteState, triggered } = countHysteresisVote(
    voteState,
    directionVote,
    k,
  );

  if (!triggered) {
    return {
      newIl: currentIl,
      newVoteState,
      nudged: false,
      directionVote,
    };
  }

  const nudgeDelta = directionVote * IL_TAP_STEP;
  const newIl = clampIlIndex(currentIl + nudgeDelta);

  return {
    newIl,
    newVoteState,
    nudged: true,
    directionVote,
  };
}
