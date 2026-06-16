/**
 * TDD tests for Phase 3 — Refine Runtime Loop (REQ-VOCAB-R)
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - AC-R-1: Coverage signal → direction vote (R-E1)
 * - AC-R-3: tap-to-gloss → known_words upsert with source='tap' (R-E3)
 * - EC-R-C: Cold-start empty known_words → fallback to computeBandCoverage, not 100%-unknown (R-U1)
 * - EC-R-D: inferred source='inferred' writer (R-O1)
 * - effectiveCoverageRatio fallback when knownLemmas is empty
 * - orchestration: processVocabSignal ties vote → hysteresis → persist-on-flip + tap writer
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabBand } from "@inputenglish/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Mock: band-coverage (computeBandCoverage for cold-start fallback tests)
// vi.fn().mockReturnValue() is cleared by clearMocks:true in vitest.config.ts.
// Use a factory that returns a stable function implementation instead.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/premium/band-coverage", () => ({
  computeBandCoverage: () => ({
    beginner: 0.8,
    basic: 0.6,
    conversation: 0.4,
    professional: 0.2,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports after mock setup
// ─────────────────────────────────────────────────────────────────────────────

import {
  effectiveCoverageRatio,
  computeDirectionVote,
  recordKnownWord,
  processVocabSignal,
} from "@/lib/premium/vocab-refine";

// ── Mock client builder ────────────────────────────────────────────────────────

/** Build a minimal mock Supabase client for known_words writes. */
function makeMockClient(opts?: {
  upsertResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
}) {
  const upsertFn = vi
    .fn()
    .mockResolvedValue(opts?.upsertResult ?? { data: [], error: null });
  const maybeSingleFn = vi
    .fn()
    .mockResolvedValue(
      opts?.selectResult ?? { data: { update_history: [] }, error: null },
    );

  const chainMock = {
    upsert: upsertFn,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: maybeSingleFn,
  };

  const fromFn = vi.fn().mockReturnValue(chainMock);

  return {
    from: fromFn,
    _mocks: { upsertFn, maybeSingleFn, chainMock, fromFn },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: effectiveCoverageRatio — cold-start fallback (EC-R-C / R-U1)
// ─────────────────────────────────────────────────────────────────────────────

describe("effectiveCoverageRatio — cold-start fallback (EC-R-C / R-U1)", () => {
  const SAMPLE_TEXT =
    "The economy is growing and the market shows positive signs this year";

  it("with a non-empty knownLemmas set, returns verifyCoverage unknownRatio", () => {
    // All words known → unknownRatio should be very low
    const allKnown = new Set([
      "the",
      "economy",
      "is",
      "growing",
      "and",
      "market",
      "shows",
      "positive",
      "signs",
      "this",
      "year",
    ]);
    const ratio = effectiveCoverageRatio(SAMPLE_TEXT, allKnown, "conversation");
    expect(ratio).toBeLessThan(0.1); // nearly 0 unknowns
  });

  it("with empty knownLemmas set, does NOT return unknownRatio≈1 (the cold-start trap)", () => {
    // verifyCoverage(text, emptySet) would return unknownRatio≈1
    // effectiveCoverageRatio must NOT do that — it must fallback
    const emptySet = new Set<string>();
    const ratio = effectiveCoverageRatio(SAMPLE_TEXT, emptySet, "conversation");
    // With computeBandCoverage mock returning { conversation: 0.4 },
    // fallback unknownRatio should be 1 - 0.4 = 0.6 (not ≈1)
    expect(ratio).toBeLessThan(0.9); // not the 100%-unknown trap
  });

  it("with undefined knownLemmas, falls back gracefully (no crash)", () => {
    const ratio = effectiveCoverageRatio(
      SAMPLE_TEXT,
      undefined,
      "conversation",
    );
    expect(typeof ratio).toBe("number");
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it("fallback ratio is derived from band coverage (1 - coverage[band])", () => {
    // computeBandCoverage mock returns { conversation: 0.4 }
    // So unknownRatio fallback = 1 - 0.4 = 0.6
    const ratio = effectiveCoverageRatio(
      "any text",
      new Set<string>(),
      "conversation",
    );
    expect(ratio).toBeCloseTo(0.6, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: computeDirectionVote — coverage signal → direction (AC-R-1 / R-E1)
// ─────────────────────────────────────────────────────────────────────────────

describe("computeDirectionVote — coverage signal → direction vote (AC-R-1 / R-E1)", () => {
  it("unknownRatio < 0.02 → too-easy → +1 vote", () => {
    // verifyCoverage result with unknownRatio=0.01 → judgeCoverage='too-easy' → +1
    expect(computeDirectionVote(0.01)).toBe(1);
  });

  it("unknownRatio in [0.02, 0.05] → optimal → 0 vote", () => {
    expect(computeDirectionVote(0.03)).toBe(0);
    expect(computeDirectionVote(0.02)).toBe(0);
    expect(computeDirectionVote(0.05)).toBe(0);
  });

  it("unknownRatio > 0.05 → too-hard → −1 vote", () => {
    expect(computeDirectionVote(0.1)).toBe(-1);
    expect(computeDirectionVote(0.5)).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: recordKnownWord — tap writer (AC-R-3 / R-E3)
// ─────────────────────────────────────────────────────────────────────────────

describe("recordKnownWord — tap writer upsert (AC-R-3 / R-E3)", () => {
  const USER_ID = "user-tap-0000-0000-0000-000000000001";

  it("calls from('known_words') with upsert for source='tap'", async () => {
    const client = makeMockClient();
    await recordKnownWord(client, USER_ID, "economy", "tap");
    expect(client.from).toHaveBeenCalledWith("known_words");
    expect(client._mocks.upsertFn).toHaveBeenCalled();
  });

  it("upsert row has user_id, lemma, source='tap', last_seen, frequency_band", async () => {
    let capturedRows: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((rows) => {
          capturedRows = rows;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    await recordKnownWord(client, USER_ID, "economy", "tap");

    const rows = capturedRows as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(USER_ID);
    expect(rows[0].lemma).toBe("economy");
    expect(rows[0].source).toBe("tap");
    expect(rows[0].last_seen).toBeDefined();
    expect(rows[0].frequency_band).toBeDefined();
  });

  it("uses onConflict 'user_id,lemma' so re-tap updates last_seen (not duplicates)", async () => {
    let capturedOptions: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((_rows, options) => {
          capturedOptions = options;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    await recordKnownWord(client, USER_ID, "economy", "tap");
    expect((capturedOptions as Record<string, unknown>)?.onConflict).toBe(
      "user_id,lemma",
    );
  });

  it("lemma not in frequency list → frequency_band='advanced'", async () => {
    let capturedRows: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((rows) => {
          capturedRows = rows;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    // "xyzzynotaword" is definitely not in the frequency list
    await recordKnownWord(client, USER_ID, "xyzzynotaword", "tap");

    const rows = capturedRows as Record<string, unknown>[];
    expect(rows[0].frequency_band).toBe("advanced");
  });

  it("calls from('known_words') for source='inferred' (R-O1)", async () => {
    const client = makeMockClient();
    await recordKnownWord(client, USER_ID, "economy", "inferred");
    expect(client.from).toHaveBeenCalledWith("known_words");
    expect(client._mocks.upsertFn).toHaveBeenCalled();
  });

  it("throws on DB error (so orchestration can detect failure)", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "network error" },
        }),
      }),
    };

    await expect(
      recordKnownWord(client, USER_ID, "economy", "tap"),
    ).rejects.toThrow(/known_words/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: processVocabSignal — orchestration (R-E1 → R-W1 → R-E2 on flip)
// ─────────────────────────────────────────────────────────────────────────────

describe("processVocabSignal — orchestration (direction vote → hysteresis → persist-on-flip)", () => {
  const USER_ID = "user-signal-0000-0000-0000-000000000001";

  /** Build a mock client that tracks all calls for assertion. */
  function makeOrchestratorClient(opts?: {
    selectResult?: { data: unknown; error: unknown };
  }) {
    const upsertFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const maybeSingleFn = vi
      .fn()
      .mockResolvedValue(
        opts?.selectResult ?? { data: { update_history: [] }, error: null },
      );

    const fromFn = vi.fn().mockReturnValue({
      upsert: upsertFn,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: maybeSingleFn,
        }),
      }),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleFn,
    });

    return { from: fromFn, _mocks: { upsertFn, maybeSingleFn, fromFn } };
  }

  it("too-easy signal (+1) accumulation — no flip before K=3", async () => {
    const client = makeOrchestratorClient();
    // Use short text with all words in knownLemmas → unknownRatio=0 → +1 vote
    const easyText = "the be";
    const knownLemmas = new Set(["the", "be"]);

    // Start with count=0, direction=0
    const result = await processVocabSignal(client, USER_ID, {
      text: easyText,
      knownLemmas,
      currentBand: "basic",
      voteState: { direction: 0 as const, count: 0 },
    });

    // After first +1 vote: count=1, no flip
    expect(result.flipped).toBe(false);
    expect(result.newVoteState.count).toBe(1);
    expect(result.newVoteState.direction).toBe(1);
  });

  it("too-hard signal (−1) then flip after K=3 consecutive → profile persisted", async () => {
    const client = makeOrchestratorClient();
    // Simulate a very hard text: many pure-alpha unknown words (regex \b[a-z]{2,}\b)
    const hardText = "zymurgy qintar xylitol the";
    const knownLemmas = new Set(["the"]);

    // 2 consecutive −1 votes already accumulated
    const result = await processVocabSignal(client, USER_ID, {
      text: hardText,
      knownLemmas,
      currentBand: "professional",
      voteState: { direction: -1 as const, count: 2 }, // needs 1 more for K=3
    });

    // unknownRatio≈0.67 → too-hard → −1 → that's the 3rd −1 → flip
    expect(result.flipped).toBe(true);
    expect(result.newBand).toBe("conversation"); // professional → conversation
    // Profile should have been written (upsert called)
    expect(client._mocks.upsertFn).toHaveBeenCalled();
    // update_history snapshot should reference 'refine'
    const upsertCall = client._mocks.upsertFn.mock.calls[0][0];
    const history = (upsertCall as Record<string, unknown>)
      .update_history as unknown[];
    const lastSnapshot = history[history.length - 1] as Record<string, unknown>;
    expect(lastSnapshot.reason).toBe("refine");
    expect(lastSnapshot.previousBand).toBe("professional");
  });

  it("no DB write when no flip occurs", async () => {
    const client = makeOrchestratorClient();
    const hardText = "zymurgy qintar xylitol the";
    const knownLemmas = new Set(["the"]);

    // Only starting count=0 → after 1 vote: count=1, no flip
    await processVocabSignal(client, USER_ID, {
      text: hardText,
      knownLemmas,
      currentBand: "professional",
      voteState: { direction: 0 as const, count: 0 },
    });

    // No flip → no profile upsert
    expect(client._mocks.upsertFn).not.toHaveBeenCalled();
  });

  it("returns updated vote state with new count and direction", async () => {
    const client = makeOrchestratorClient();
    const easyText = "the be";
    const knownLemmas = new Set(["the", "be"]);

    const result = await processVocabSignal(client, USER_ID, {
      text: easyText,
      knownLemmas,
      currentBand: "basic",
      voteState: { direction: 1 as const, count: 1 },
    });

    // After this +1 vote: count=2 (still one short of K=3 flip)
    expect(result.newVoteState.count).toBe(2);
    expect(result.newVoteState.direction).toBe(1);
    expect(result.flipped).toBe(false);
  });

  it("returns currentBand as newBand when no flip", async () => {
    const client = makeOrchestratorClient();
    const easyText = "the be";
    const knownLemmas = new Set(["the", "be"]);

    const result = await processVocabSignal(client, USER_ID, {
      text: easyText,
      knownLemmas,
      currentBand: "conversation",
      voteState: { direction: 0 as const, count: 0 },
    });

    expect(result.newBand).toBe("conversation");
  });
});
