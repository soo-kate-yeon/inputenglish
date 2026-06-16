/**
 * TDD tests for POST /api/premium/vocab-signal (REQ-VOCAB-R orchestration route)
 *
 * RED → GREEN → REFACTOR
 *
 * Tests the thin route layer that:
 * - Authenticates the user (requireApiUser)
 * - Accepts { text, currentBand, voteState } payload
 * - Delegates to processVocabSignal()
 * - Returns { flipped, newBand, newVoteState, directionVote }
 *
 * Mocking pattern: mirrors vocab-assessment/route.test.ts
 * vi.hoisted is used for mockProcessVocabSignal because restoreMocks:true in
 * vitest.config.ts restores vi.fn() instances created in vi.mock factories.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VocabBand } from "@inputenglish/shared";
import type { VoteState } from "@inputenglish/shared";

// ── Hoisted mock for processVocabSignal ───────────────────────────────────────
// vi.hoisted runs before vi.mock factories, allowing us to reference the fn
// inside the factory. restoreMocks:true doesn't clear hoisted vi.fn() refs.

const { mockProcessVocabSignal } = vi.hoisted(() => ({
  mockProcessVocabSignal: vi.fn(),
}));

// ── Mock declarations ─────────────────────────────────────────────────────────

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: () =>
    Promise.resolve({ id: "user-signal-route-0000-000000000001" }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: () => Promise.resolve({ data: [], error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { update_history: [] }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/premium/vocab-refine", () => ({
  processVocabSignal: mockProcessVocabSignal,
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { POST } from "@/app/api/premium/vocab-signal/route";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_USER_ID = "user-signal-route-0000-000000000001";

const DEFAULT_SIGNAL_RESULT = {
  flipped: false,
  newBand: "conversation" as VocabBand,
  newVoteState: { direction: 1 as const, count: 1 } satisfies VoteState,
  directionVote: 1 as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/premium/vocab-signal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-signal", () => {
  beforeEach(() => {
    mockProcessVocabSignal.mockResolvedValue(DEFAULT_SIGNAL_RESULT);
  });

  it("returns 200 with signal result on valid payload", async () => {
    const req = makeRequest({
      text: "The economy is growing rapidly",
      currentBand: "conversation",
      voteState: { direction: 0, count: 0 },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      flipped: false,
      newBand: "conversation",
      newVoteState: { direction: 1, count: 1 },
      directionVote: 1,
    });
  });

  it("calls processVocabSignal with userId, text, currentBand, voteState", async () => {
    const req = makeRequest({
      text: "The market is recovering",
      currentBand: "basic",
      voteState: { direction: 1, count: 2 },
    });

    await POST(req as unknown as import("next/server").NextRequest);

    expect(mockProcessVocabSignal).toHaveBeenCalledWith(
      expect.anything(), // client
      MOCK_USER_ID,
      expect.objectContaining({
        text: "The market is recovering",
        currentBand: "basic",
        voteState: { direction: 1, count: 2 },
      }),
    );
  });

  it("returns 400 when text is missing", async () => {
    const req = makeRequest({
      currentBand: "conversation",
      voteState: { direction: 0, count: 0 },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when currentBand is missing", async () => {
    const req = makeRequest({
      text: "some text",
      voteState: { direction: 0, count: 0 },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when currentBand is not a valid VocabBand", async () => {
    const req = makeRequest({
      text: "some text",
      currentBand: "invalid-band",
      voteState: { direction: 0, count: 0 },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("accepts missing voteState and defaults to initial {direction:0, count:0}", async () => {
    const req = makeRequest({
      text: "The economy is growing",
      currentBand: "conversation",
      // No voteState provided
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    // Should default voteState to { direction: 0, count: 0 }
    expect(mockProcessVocabSignal).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_ID,
      expect.objectContaining({
        voteState: { direction: 0, count: 0 },
      }),
    );
  });

  it("propagates flip=true response when processVocabSignal returns flip", async () => {
    mockProcessVocabSignal.mockResolvedValueOnce({
      flipped: true,
      newBand: "professional",
      newVoteState: { direction: 0, count: 0 },
      directionVote: 1,
    });

    const req = makeRequest({
      text: "The economy",
      currentBand: "conversation",
      voteState: { direction: 1, count: 2 },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flipped).toBe(true);
    expect(body.newBand).toBe("professional");
  });

  it("returns 500 when processVocabSignal throws", async () => {
    mockProcessVocabSignal.mockRejectedValueOnce(new Error("DB error"));

    const req = makeRequest({
      text: "The economy",
      currentBand: "conversation",
      voteState: { direction: 0, count: 0 },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(500);
  });
});
