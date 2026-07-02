/**
 * TDD tests for il-tap-adjustment (Task 3.4, SPEC-WEB-001 Phase 3, REQ-WEB-002-W1, AC-002-3)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Adapts the existing vote/hysteresis mechanism (applyHysteresisVote from
 * @inputenglish/shared) so that instead of flipping a discrete VocabBand, it nudges
 * a continuous il_index in small increments (+-0.1) when tap rate is outside the
 * 2-5% target band. Reuses the vote-counting/hysteresis primitives rather than
 * duplicating them: this module converts a tap rate into the same -1/0/+1 vote
 * vocab-refine.ts already produces, runs it through applyHysteresisVote() using a
 * synthetic 2-band ladder {lower, upper} so the K-consecutive-vote gating logic is
 * reused verbatim, then maps a flip into a +-0.1 il_index nudge.
 */
import { describe, expect, it } from "vitest";
import {
  tapRateToVote,
  adjustIlFromTapRate,
  IL_TAP_STEP,
} from "./il-tap-adjustment";

describe("tapRateToVote", () => {
  it("votes -1 (too hard / lower band demand) when tap rate is above the 5% ceiling", () => {
    expect(tapRateToVote(0.08)).toBe(-1);
  });

  it("votes +1 (too easy / raise) when tap rate is below the 2% floor", () => {
    expect(tapRateToVote(0.01)).toBe(1);
  });

  it("votes 0 (optimal) when tap rate is within the 2-5% target band", () => {
    expect(tapRateToVote(0.03)).toBe(0);
    expect(tapRateToVote(0.02)).toBe(0);
    expect(tapRateToVote(0.05)).toBe(0);
  });
});

describe("adjustIlFromTapRate", () => {
  it("does not nudge il_index on a single out-of-band tap rate (hysteresis gate, K=3 default)", () => {
    const result = adjustIlFromTapRate({
      currentIl: 4.0,
      tapRate: 0.01, // too easy -> +1 vote
      voteState: { direction: 0, count: 0 },
    });

    expect(result.newIl).toBe(4.0);
    expect(result.nudged).toBe(false);
    expect(result.newVoteState).toEqual({ direction: 1, count: 1 });
  });

  it("nudges il_index up by +0.1 after K consecutive too-easy votes (AC-002-3: 4.0 -> 4.2 over 2 flips)", () => {
    let state = { direction: 0 as -1 | 0 | 1, count: 0 };
    let il = 4.0;

    for (let i = 0; i < 3; i++) {
      const result = adjustIlFromTapRate({
        currentIl: il,
        tapRate: 0.01,
        voteState: state,
      });
      il = result.newIl;
      state = result.newVoteState;
    }

    expect(il).toBe(4.1);
    expect(state).toEqual({ direction: 0, count: 0 });
  });

  it("AC-002-3: tap rate 1% measured at IL 4.0 nudges upward toward 4.2 over repeated flips", () => {
    let state = { direction: 0 as -1 | 0 | 1, count: 0 };
    let il = 4.0;

    // Drive 2 full flips (K=3 votes each) to reach +0.2 total.
    for (let flip = 0; flip < 2; flip++) {
      for (let i = 0; i < 3; i++) {
        const result = adjustIlFromTapRate({
          currentIl: il,
          tapRate: 0.01,
          voteState: state,
        });
        il = result.newIl;
        state = result.newVoteState;
      }
    }

    expect(il).toBeCloseTo(4.2, 5);
  });

  it("nudges il_index down by -0.1 after K consecutive too-hard votes", () => {
    let state = { direction: 0 as -1 | 0 | 1, count: 0 };
    let il = 4.0;

    for (let i = 0; i < 3; i++) {
      const result = adjustIlFromTapRate({
        currentIl: il,
        tapRate: 0.08,
        voteState: state,
      });
      il = result.newIl;
      state = result.newVoteState;
    }

    expect(il).toBeCloseTo(3.9, 5);
  });

  it("resets the vote streak when tap rate returns to the optimal 2-5% band", () => {
    const result = adjustIlFromTapRate({
      currentIl: 4.0,
      tapRate: 0.03,
      voteState: { direction: 1, count: 2 },
    });

    expect(result.nudged).toBe(false);
    expect(result.newVoteState).toEqual({ direction: 0, count: 0 });
  });

  it("clamps the nudge at the IL floor (1.0) — never goes below the invariant range", () => {
    let state = { direction: 0 as -1 | 0 | 1, count: 0 };
    let il = 1.0;

    for (let i = 0; i < 3; i++) {
      const result = adjustIlFromTapRate({
        currentIl: il,
        tapRate: 0.08, // too hard -> would push down
        voteState: state,
      });
      il = result.newIl;
      state = result.newVoteState;
    }

    expect(il).toBeGreaterThanOrEqual(1.0);
    expect(il).toBe(1.0);
  });

  it("clamps the nudge at the IL ceiling (7.0) — never exceeds the invariant range", () => {
    let state = { direction: 0 as -1 | 0 | 1, count: 0 };
    let il = 7.0;

    for (let i = 0; i < 3; i++) {
      const result = adjustIlFromTapRate({
        currentIl: il,
        tapRate: 0.01, // too easy -> would push up
        voteState: state,
      });
      il = result.newIl;
      state = result.newVoteState;
    }

    expect(il).toBeLessThanOrEqual(7.0);
    expect(il).toBe(7.0);
  });

  it("exposes IL_TAP_STEP as 0.1 (the documented nudge increment)", () => {
    expect(IL_TAP_STEP).toBe(0.1);
  });
});
