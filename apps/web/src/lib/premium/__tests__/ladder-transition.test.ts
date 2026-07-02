/**
 * SPEC-WEB-001 Phase 5 — Task 5.4: system-driven RWL -> no-captions transition
 * (REQ-WEB-004-E2, AC-004-2). Reuses the existing IL/tap-rate signal
 * (tapRateToVote / coverageDifficultyAdjustment) from il-tap-adjustment.ts,
 * gated through countHysteresisVote (K consecutive same-direction votes)
 * so a single noisy tap-rate sample can't flicker the caption UI.
 */
import { describe, expect, it } from "vitest";
import { makeInitialVoteState } from "@inputenglish/shared";
import {
  shouldTransitionToNoCaptions,
  shouldOfferPrereadStep,
} from "../ladder-transition";

describe("shouldTransitionToNoCaptions (AC-004-2, E2)", () => {
  it("does not transition on a single comfortable sample (hysteresis requires K consecutive votes)", () => {
    const result = shouldTransitionToNoCaptions({
      tapRate: 0.01,
      voteState: makeInitialVoteState(),
    });
    expect(result.shouldTransition).toBe(false);
    expect(result.newVoteState).toEqual({ direction: 1, count: 1 });
  });

  it("is system-driven true once K (default 3) consecutive comfortable votes accumulate", () => {
    let voteState = makeInitialVoteState();
    let result = shouldTransitionToNoCaptions({ tapRate: 0.01, voteState });
    voteState = result.newVoteState;
    result = shouldTransitionToNoCaptions({ tapRate: 0.01, voteState });
    voteState = result.newVoteState;
    result = shouldTransitionToNoCaptions({ tapRate: 0.01, voteState });

    expect(result.shouldTransition).toBe(true);
  });

  it("resets the streak and stays false when the tap rate is within the target 2-5% band (still learning at RWL difficulty)", () => {
    const result = shouldTransitionToNoCaptions({
      tapRate: 0.035,
      voteState: { direction: 1, count: 2 },
    });
    expect(result.shouldTransition).toBe(false);
    expect(result.newVoteState).toEqual({ direction: 0, count: 0 });
  });

  it("is false when the tap rate is high (too hard — should stay in RWL, not drop captions), even after K consecutive votes", () => {
    let voteState = makeInitialVoteState();
    let result = shouldTransitionToNoCaptions({ tapRate: 0.2, voteState });
    voteState = result.newVoteState;
    result = shouldTransitionToNoCaptions({ tapRate: 0.2, voteState });
    voteState = result.newVoteState;
    result = shouldTransitionToNoCaptions({ tapRate: 0.2, voteState });

    expect(result.shouldTransition).toBe(false);
  });

  it("honors an explicit manual override (user toggle) regardless of tap rate or vote state (secondary/override control per D8)", () => {
    const result = shouldTransitionToNoCaptions({
      tapRate: 0.2,
      voteState: makeInitialVoteState(),
      manualOverride: true,
    });
    expect(result.shouldTransition).toBe(true);
  });
});

describe("shouldOfferPrereadStep (EC-004-A, W1 — 0.5 script pre-read safety net)", () => {
  it("offers the 0.5 pre-read step when IL is near the user's ceiling and tap rate is high", () => {
    expect(
      shouldOfferPrereadStep({
        userIl: 4.0,
        contentIl: 4.0,
        tapRate: 0.15,
      }),
    ).toBe(true);
  });

  it("does not force the pre-read step when tap rate is comfortable, even near the IL ceiling", () => {
    expect(
      shouldOfferPrereadStep({
        userIl: 4.0,
        contentIl: 4.0,
        tapRate: 0.03,
      }),
    ).toBe(false);
  });

  it("does not offer the pre-read step when content IL is well below the user's ceiling, even with a high tap rate", () => {
    expect(
      shouldOfferPrereadStep({
        userIl: 4.0,
        contentIl: 2.0,
        tapRate: 0.15,
      }),
    ).toBe(false);
  });

  it("fails closed (never offers pre-read) when userIl is not available, even if content IL and tap rate would otherwise qualify", () => {
    expect(
      shouldOfferPrereadStep({
        userIl: undefined,
        contentIl: 4.0,
        tapRate: 0.15,
      }),
    ).toBe(false);
  });
});
