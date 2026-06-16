/**
 * TDD tests for Phase 3 — Hysteresis Band Adjustment (REQ-VOCAB-R-W1)
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - AC-R-2: K consecutive same-direction votes → flip by one step + reset counter
 * - EC-R-A: Mixed or < K votes → no flip (hysteresis guards)
 * - EC-R-B: Band clamp at beginner (−1) and professional (+1)
 * - No-op clamp at edges: a flip that would exceed range resets counter instead
 * - Zero vote resets counter
 * - Direction change resets counter
 * - flipped flag is false when no flip occurred, true when flip occurred
 */

import { describe, it, expect } from "vitest";
import {
  applyHysteresisVote,
  makeInitialVoteState,
} from "../lib/vocab-band-hysteresis";
import type { VoteState } from "../lib/vocab-band-hysteresis";
import type { VocabBand } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run N identical votes through the hysteresis function, returning the final result. */
function runVotes(
  band: VocabBand,
  voteValue: -1 | 0 | 1,
  count: number,
  k = 3,
): { band: VocabBand; voteState: VoteState; flipped: boolean } {
  let currentBand = band;
  let state = makeInitialVoteState();
  let result = { band: currentBand, voteState: state, flipped: false };

  for (let i = 0; i < count; i++) {
    result = applyHysteresisVote(currentBand, state, voteValue, { k });
    currentBand = result.band;
    state = result.voteState;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: makeInitialVoteState
// ─────────────────────────────────────────────────────────────────────────────

describe("makeInitialVoteState", () => {
  it("returns direction=0, count=0", () => {
    const state = makeInitialVoteState();
    expect(state.direction).toBe(0);
    expect(state.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Basic vote accumulation (no flip yet)
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — vote accumulation (no flip)", () => {
  it("after 1 +1 vote with K=3: band unchanged, count=1, no flip", () => {
    const result = applyHysteresisVote("basic", makeInitialVoteState(), 1, {
      k: 3,
    });
    expect(result.band).toBe("basic");
    expect(result.voteState.count).toBe(1);
    expect(result.voteState.direction).toBe(1);
    expect(result.flipped).toBe(false);
  });

  it("after 2 +1 votes with K=3: band unchanged, count=2, no flip", () => {
    const result = runVotes("conversation", 1, 2, 3);
    expect(result.band).toBe("conversation");
    expect(result.voteState.count).toBe(2);
    expect(result.flipped).toBe(false);
  });

  it("after 2 −1 votes with K=3: band unchanged, count=2, no flip", () => {
    const result = runVotes("conversation", -1, 2, 3);
    expect(result.band).toBe("conversation");
    expect(result.voteState.count).toBe(2);
    expect(result.flipped).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Flip on K-th consecutive same-direction vote (AC-R-2)
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — flip on K-th consecutive vote (AC-R-2)", () => {
  it("3 consecutive +1 votes → flip band up by one step (conversation→professional)", () => {
    const result = runVotes("conversation", 1, 3, 3);
    expect(result.band).toBe("professional");
    expect(result.flipped).toBe(true);
  });

  it("3 consecutive +1 votes → flip basic→conversation", () => {
    const result = runVotes("basic", 1, 3, 3);
    expect(result.band).toBe("conversation");
    expect(result.flipped).toBe(true);
  });

  it("3 consecutive +1 votes → flip beginner→basic", () => {
    const result = runVotes("beginner", 1, 3, 3);
    expect(result.band).toBe("basic");
    expect(result.flipped).toBe(true);
  });

  it("3 consecutive −1 votes → flip band down by one step (conversation→basic)", () => {
    const result = runVotes("conversation", -1, 3, 3);
    expect(result.band).toBe("basic");
    expect(result.flipped).toBe(true);
  });

  it("3 consecutive −1 votes → flip professional→conversation", () => {
    const result = runVotes("professional", -1, 3, 3);
    expect(result.band).toBe("conversation");
    expect(result.flipped).toBe(true);
  });

  it("counter resets to 0 after flip", () => {
    const result = runVotes("conversation", 1, 3, 3);
    expect(result.voteState.count).toBe(0);
  });

  it("direction resets to 0 after flip", () => {
    const result = runVotes("conversation", 1, 3, 3);
    expect(result.voteState.direction).toBe(0);
  });

  it("K=5: no flip after 4 same-direction votes, flip on 5th", () => {
    const no_flip_result = runVotes("basic", 1, 4, 5);
    expect(no_flip_result.band).toBe("basic");
    expect(no_flip_result.flipped).toBe(false);

    const flip_result = runVotes("basic", 1, 5, 5);
    expect(flip_result.band).toBe("conversation");
    expect(flip_result.flipped).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Zero vote resets counter (EC-R-A)
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — zero vote resets counter (EC-R-A)", () => {
  it("2 +1 votes then 0 vote → counter resets, no flip", () => {
    let band: VocabBand = "basic";
    let state = makeInitialVoteState();

    // Two +1 votes
    let r = applyHysteresisVote(band, state, 1, { k: 3 });
    band = r.band;
    state = r.voteState;
    r = applyHysteresisVote(band, state, 1, { k: 3 });
    band = r.band;
    state = r.voteState;

    expect(state.count).toBe(2);

    // Zero vote
    r = applyHysteresisVote(band, state, 0, { k: 3 });
    expect(r.band).toBe("basic");
    expect(r.voteState.count).toBe(0);
    expect(r.voteState.direction).toBe(0);
    expect(r.flipped).toBe(false);
  });

  it("after zero-reset, the next K votes still flip", () => {
    // 2 +1 votes, then 0 reset, then K more +1 votes → should flip
    let band: VocabBand = "basic";
    let state = makeInitialVoteState();

    // Build up 2 votes
    for (let i = 0; i < 2; i++) {
      const r = applyHysteresisVote(band, state, 1, { k: 3 });
      band = r.band;
      state = r.voteState;
    }

    // Reset with 0
    const reset = applyHysteresisVote(band, state, 0, { k: 3 });
    band = reset.band;
    state = reset.voteState;

    // Now apply K=3 votes → should flip
    const result = runVotes(band, 1, 3, 3);
    expect(result.band).toBe("conversation");
    expect(result.flipped).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Direction change resets counter (EC-R-A)
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — direction change resets counter (EC-R-A)", () => {
  it("+1, −1, +1 pattern: counter resets on direction change, no flip", () => {
    let band: VocabBand = "conversation";
    let state = makeInitialVoteState();

    // +1 vote
    let r = applyHysteresisVote(band, state, 1, { k: 3 });
    band = r.band;
    state = r.voteState;
    expect(state.count).toBe(1);

    // −1 vote (direction change → reset)
    r = applyHysteresisVote(band, state, -1, { k: 3 });
    band = r.band;
    state = r.voteState;
    expect(state.count).toBe(1); // starts fresh in new direction
    expect(state.direction).toBe(-1);
    expect(r.flipped).toBe(false);

    // +1 vote (direction change again → reset)
    r = applyHysteresisVote(band, state, 1, { k: 3 });
    expect(r.voteState.count).toBe(1);
    expect(r.voteState.direction).toBe(1);
    expect(r.flipped).toBe(false);
    expect(r.band).toBe("conversation"); // no flip throughout
  });

  it("+1, +1, −1, +1, +1 (mixed 5-vote sequence): no flip (never reaches K=3)", () => {
    let band: VocabBand = "conversation";
    let state = makeInitialVoteState();

    const votes: (-1 | 0 | 1)[] = [1, 1, -1, 1, 1];
    let lastFlipped = false;
    for (const v of votes) {
      const r = applyHysteresisVote(band, state, v, { k: 3 });
      band = r.band;
      state = r.voteState;
      lastFlipped = r.flipped;
    }

    // No flip should have occurred (max streak is 2)
    expect(band).toBe("conversation");
    expect(lastFlipped).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Band clamp at edges (EC-R-B)
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — band clamp at edges (EC-R-B)", () => {
  it("+1 votes at professional: no flip past professional, no-op + counter reset", () => {
    const result = runVotes("professional", 1, 3, 3);
    // Should stay at professional (upper clamp)
    expect(result.band).toBe("professional");
    // A flip that would exceed range is a no-op but counter should reset
    expect(result.voteState.count).toBe(0);
  });

  it("−1 votes at beginner: no flip below beginner, no-op + counter reset", () => {
    const result = runVotes("beginner", -1, 3, 3);
    // Should stay at beginner (lower clamp)
    expect(result.band).toBe("beginner");
    // A flip that would exceed range is a no-op but counter should reset
    expect(result.voteState.count).toBe(0);
  });

  it("after clamp no-op reset at professional, subsequent −1 votes can flip down", () => {
    // First push 3 +1 votes (no-op at professional ceiling) → counter resets
    let band: VocabBand = "professional";
    let state = makeInitialVoteState();

    const clampResult = runVotes(band, 1, 3, 3);
    band = clampResult.band;
    state = clampResult.voteState;
    expect(band).toBe("professional");
    expect(state.count).toBe(0);

    // Now 3 −1 votes → should flip professional → conversation
    const downResult = runVotes(band, -1, 3, 3);
    expect(downResult.band).toBe("conversation");
    expect(downResult.flipped).toBe(true);
  });

  it("after clamp no-op reset at beginner, subsequent +1 votes can flip up", () => {
    // First push 3 −1 votes (no-op at beginner floor) → counter resets
    const clampResult = runVotes("beginner", -1, 3, 3);
    const band = clampResult.band;
    const state = clampResult.voteState;
    expect(band).toBe("beginner");
    expect(state.count).toBe(0);

    // Now 3 +1 votes → should flip beginner → basic
    const upResult = runVotes(band, 1, 3, 3);
    expect(upResult.band).toBe("basic");
    expect(upResult.flipped).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 7: flipped is false unless a band transition occurred
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — flipped flag accuracy", () => {
  it("flipped is false for K−1 votes", () => {
    const result = runVotes("basic", 1, 2, 3);
    expect(result.flipped).toBe(false);
  });

  it("flipped is true exactly on the K-th vote", () => {
    // K-1 votes → not flipped
    let band: VocabBand = "basic";
    let state = makeInitialVoteState();
    for (let i = 0; i < 2; i++) {
      const r = applyHysteresisVote(band, state, 1, { k: 3 });
      band = r.band;
      state = r.voteState;
      expect(r.flipped).toBe(false);
    }

    // K-th vote → flipped
    const r = applyHysteresisVote(band, state, 1, { k: 3 });
    expect(r.flipped).toBe(true);
  });

  it("flipped is false on the (K+1)-th vote after a flip (counter already reset)", () => {
    // 3 votes flip, then 4th vote starts fresh counter (not a double flip)
    let band: VocabBand = "basic";
    let state = makeInitialVoteState();
    for (let i = 0; i < 3; i++) {
      const r = applyHysteresisVote(band, state, 1, { k: 3 });
      band = r.band;
      state = r.voteState;
    }
    // Band is now conversation, counter=0

    // 4th vote → count=1, no flip
    const r = applyHysteresisVote(band, state, 1, { k: 3 });
    expect(r.flipped).toBe(false);
    expect(r.voteState.count).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 8: Default K=3 when no options provided
// ─────────────────────────────────────────────────────────────────────────────

describe("applyHysteresisVote — default K=3", () => {
  it("flips on 3rd consecutive vote when no options supplied", () => {
    let band: VocabBand = "basic";
    let state = makeInitialVoteState();
    let result = { band, voteState: state, flipped: false };

    for (let i = 0; i < 3; i++) {
      result = applyHysteresisVote(band, state, 1);
      band = result.band;
      state = result.voteState;
    }

    expect(result.flipped).toBe(true);
    expect(result.band).toBe("conversation");
  });
});
