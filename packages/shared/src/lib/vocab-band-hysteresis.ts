// @MX:ANCHOR: [AUTO] Hysteresis band adjustment — single pure-function entry point for band flips.
// @MX:REASON: [AUTO] Band-flip invariant: requires K consecutive same-direction non-zero votes
//   before flipping by exactly one step. A 0 vote or direction change resets the counter.
//   A flip that would exceed the 4-band range (beginner..professional) is a no-op that resets.
//   This function is the ONLY place where band transitions are computed; all persistence is
//   handled by callers. (REQ-VOCAB-R-W1)
//
// @MX:NOTE: [AUTO] Vote state storage:
//   VoteState is stored in update_history (the latest snapshot in user_vocab_profiles.update_history)
//   or passed around as an in-memory value derived from the persisted snapshot. The orchestration
//   layer (vocab-refine.ts) reads voteState from the last update_history entry on each signal,
//   then passes it to applyHysteresisVote, and persists the new voteState on flip.
//
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-R-W1

import type { VocabBand } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Running vote state for hysteresis.
 *
 * direction: the current streak direction (0 = no streak / reset)
 * count: how many consecutive same-direction non-zero votes have been cast
 */
export interface VoteState {
  direction: -1 | 0 | 1;
  count: number;
}

/** Options for applyHysteresisVote. */
export interface HysteresisOptions {
  /** Number of consecutive same-direction votes required to flip the band. Default: 3. */
  k?: number;
}

/** Result of applyHysteresisVote. */
export interface HysteresisResult {
  /** The (possibly updated) band after applying the vote. */
  band: VocabBand;
  /** Updated vote state to persist/pass to next call. */
  voteState: VoteState;
  /** True if a band flip occurred in this call. */
  flipped: boolean;
}

// ── Band ordering ─────────────────────────────────────────────────────────────

const BAND_ORDER: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

// ── Exported factory ──────────────────────────────────────────────────────────

/** Returns an initial (zero) vote state for a new user or after a flush. */
export function makeInitialVoteState(): VoteState {
  return { direction: 0, count: 0 };
}

// ── Domain-agnostic vote counting ──────────────────────────────────────────────

/** Result of countHysteresisVote. */
export interface VoteCountResult {
  /** Updated vote state to persist/pass to next call. */
  voteState: VoteState;
  /** True once K consecutive same-direction votes have accumulated this call. */
  triggered: boolean;
}

/**
 * Domain-agnostic K-consecutive-vote counter, extracted from applyHysteresisVote
 * so any ordered domain (not just the 4-value VocabBand ladder) can reuse the exact
 * same counting/reset semantics without duplicating them. See
 * apps/web/src/lib/premium/il-tap-adjustment.ts for the continuous-IL consumer.
 *
 * @MX:ANCHOR: [AUTO] Domain-agnostic vote-counting primitive (REQ-VOCAB-R-W1 origin).
 * @MX:REASON: [AUTO] Rules enforced here (same as applyHysteresisVote's original inline logic):
 *   1. A 0 vote always resets the counter (direction = 0, count = 0).
 *   2. A direction change (new vote ≠ current direction, both non-zero) resets
 *      the counter and starts accumulating in the new direction (count = 1).
 *   3. K consecutive same-direction votes → `triggered: true`, counter reset.
 *      The caller decides what a "trigger" means for its own domain (band flip,
 *      continuous nudge, etc.) — this function has no domain-specific range logic.
 *
 * @param voteState - The current running vote state.
 * @param vote - The new directional vote: -1 (lower), 0 (optimal/reset), +1 (raise).
 * @param k - Consecutive same-direction votes required to trigger (default 3).
 */
export function countHysteresisVote(
  voteState: VoteState,
  vote: -1 | 0 | 1,
  k = 3,
): VoteCountResult {
  // Case 1: Zero vote → reset
  if (vote === 0) {
    return { voteState: { direction: 0, count: 0 }, triggered: false };
  }

  // Case 2: Direction change → reset counter, start in new direction
  const isContinuation = voteState.direction === vote && voteState.count > 0;
  const newCount = isContinuation ? voteState.count + 1 : 1;

  // Case 3: K reached → trigger, reset counter
  if (newCount >= k) {
    return { voteState: { direction: 0, count: 0 }, triggered: true };
  }

  // Accumulating (not yet at K)
  return { voteState: { direction: vote, count: newCount }, triggered: false };
}

// ── Core hysteresis logic ─────────────────────────────────────────────────────

/**
 * Applies a single directional vote to the hysteresis state and returns the
 * (possibly updated) band, new vote state, and a flip indicator.
 *
 * @MX:ANCHOR: [AUTO] Band-flip invariant implementation (REQ-VOCAB-R-W1).
 * @MX:REASON: [AUTO] Rules enforced here:
 *   1. A 0 vote always resets the counter (direction = 0, count = 0).
 *   2. A direction change (new vote ≠ current direction, both non-zero) resets
 *      the counter and starts accumulating in the new direction (count = 1).
 *   3. K consecutive same-direction votes → flip band by ±1, reset counter.
 *   4. Flip that would exceed [beginner, professional] is a no-op (band unchanged)
 *      but still resets the counter (treated as "attempted flip").
 *   5. Band flips by exactly ONE step per flip event.
 *
 *   Delegates the domain-agnostic counting (1-3 above) to countHysteresisVote();
 *   this function owns only the band-specific range-clamp (4) and band lookup (5).
 *
 * @param currentBand - The user's current estimated band.
 * @param voteState - The current running vote state.
 * @param vote - The new directional vote: -1 (too-hard / lower), 0 (optimal), +1 (too-easy / raise).
 * @param options - Optional K override (default 3).
 */
export function applyHysteresisVote(
  currentBand: VocabBand,
  voteState: VoteState,
  vote: -1 | 0 | 1,
  options: HysteresisOptions = {},
): HysteresisResult {
  const k = options.k ?? 3;

  const { voteState: newVoteState, triggered } = countHysteresisVote(
    voteState,
    vote,
    k,
  );

  if (!triggered) {
    return { band: currentBand, voteState: newVoteState, flipped: false };
  }

  const bandIdx = BAND_ORDER.indexOf(currentBand);
  const targetIdx = bandIdx + vote; // +1 = raise, -1 = lower

  // Case 4: Clamp — flip that would exceed valid range is a no-op (vote state
  // is already reset by countHysteresisVote's trigger branch).
  if (targetIdx < 0 || targetIdx >= BAND_ORDER.length) {
    return { band: currentBand, voteState: newVoteState, flipped: false };
  }

  return {
    band: BAND_ORDER[targetIdx],
    voteState: newVoteState,
    flipped: true,
  };
}
