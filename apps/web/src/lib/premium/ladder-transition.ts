// @MX:ANCHOR: [AUTO] RWL -> no-captions transition decision (Task 5.4, REQ-WEB-004-E2, AC-004-2).
// @MX:REASON: [AUTO] Reuses tapRateToVote() (il-tap-adjustment.ts), which itself delegates
//   to coverageDifficultyAdjustment() — the SAME 2-5% target-band judgment used by both the
//   discrete VocabBand Refine loop and the continuous IL tap-adjustment path. No new
//   difficulty heuristic is invented here: vote=+1 ("too easy" / comfortable tap rate) means
//   the system should raise difficulty by dropping captions; vote<=0 (target band or too
//   hard) means stay in RWL. Gated through countHysteresisVote() (vocab-band-hysteresis.ts)
//   requiring K consecutive same-direction votes before triggering — a bare single-sample
//   vote would flicker the caption UI on/off as a noisy running tap rate crosses the
//   threshold; the same reasoning that gates the discrete VocabBand path and the IL nudge
//   path applies here. A manual override always wins (D8: toggle is a secondary/override
//   control, always available) and does not consume/reset the vote state.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.4 (REQ-WEB-004-E2, AC-004-2, D8)
import { tapRateToVote } from "./il-tap-adjustment";
import { countHysteresisVote, type VoteState } from "@inputenglish/shared";

export interface ShouldTransitionParams {
  /** Running unknown-word tap rate for the current RWL session (0-1 fraction). */
  tapRate: number;
  /** Running hysteresis vote state (persist and pass back the returned newVoteState). */
  voteState: VoteState;
  /** Manual user toggle override — always honored regardless of tap rate (D8). */
  manualOverride?: boolean;
  /** Consecutive same-direction votes required to trigger. Default: 3 (matches il-tap-adjustment). */
  k?: number;
}

export interface ShouldTransitionResult {
  /** True once the system (or manual override) decides to present no-captions. */
  shouldTransition: boolean;
  /** Updated vote state to persist/pass to the next call. */
  newVoteState: VoteState;
}

/**
 * System-driven decision: is it time to present the no-captions (stage 2)
 * step instead of RWL (stage 1)? True once K consecutive "too easy" votes
 * accumulate (comfortable tap rate), or immediately if manually overridden.
 */
export function shouldTransitionToNoCaptions(
  params: ShouldTransitionParams,
): ShouldTransitionResult {
  const { tapRate, voteState, manualOverride, k = 3 } = params;

  if (manualOverride) {
    return { shouldTransition: true, newVoteState: voteState };
  }

  const vote = tapRateToVote(tapRate);
  const { voteState: newVoteState, triggered } = countHysteresisVote(
    voteState,
    vote,
    k,
  );

  return { shouldTransition: triggered && vote === 1, newVoteState };
}

export interface ShouldOfferPrereadParams {
  /**
   * The user's current il_index. Pass `undefined` when the real value isn't
   * available yet (e.g. not threaded through the session view model) — the
   * gate fails CLOSED (never offers pre-read) rather than silently comparing
   * a fabricated/duplicated value against itself, which would always pass
   * the near-ceiling check regardless of actual proximity.
   */
  userIl: number | undefined;
  /** The content's il rating. */
  contentIl: number;
  /** Running unknown-word tap rate for the content (0-1 fraction). */
  tapRate: number;
}

/** IL delta within which content is considered "near the user's ceiling". */
const NEAR_CEILING_IL_DELTA = 0.5;
/** Tap rate above which content is considered "high" (difficult) for the pre-read gate. */
const HIGH_TAP_RATE_THRESHOLD = 0.1;

/**
 * EC-004-A / W1: decides whether to offer the optional 0.5 script pre-read
 * step before RWL. Only offered when content is near the user's IL ceiling
 * AND the tap rate is high — never forced daily, never for comfortable content.
 * Requires a real `userIl` (fails closed to `false` when absent).
 */
export function shouldOfferPrereadStep(
  params: ShouldOfferPrereadParams,
): boolean {
  const { userIl, contentIl, tapRate } = params;
  if (userIl === undefined) return false;
  const nearCeiling = contentIl >= userIl - NEAR_CEILING_IL_DELTA;
  const highTapRate = tapRate > HIGH_TAP_RATE_THRESHOLD;
  return nearCeiling && highTapRate;
}
