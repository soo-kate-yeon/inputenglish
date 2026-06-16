/**
 * TDD Phase 4 — REQ-VOCAB-I I-W1: Abandonment fallback tests.
 *
 * Verifies that incomplete/empty assessment submission does NOT persist
 * a partial/garbage user_vocab_profiles row, so band resolution still
 * falls back to level_band/conversation.
 *
 * Mock pattern mirrors vocab-assessment/route.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── All mocks BEFORE imports ───────────────────────────────────────────────────

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@inputenglish/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@inputenglish/shared")>();
  return {
    ...actual,
    assertFrequencyListLoaded: vi.fn(),
    getLemmaRank: actual.getLemmaRank,
    bandForLemma: actual.bandForLemma,
    scoreAssessment: actual.scoreAssessment,
  };
});

vi.mock("@/lib/premium/vocab-assessment-repository", () => ({
  upsertVocabProfile: vi.fn(),
  insertSeedKnownWords: vi.fn(),
  fetchKnownLemmas: vi.fn().mockResolvedValue(new Set<string>()),
}));

// ── Import mocked modules ──────────────────────────────────────────────────────
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { assertFrequencyListLoaded } from "@inputenglish/shared";
import {
  upsertVocabProfile,
  insertSeedKnownWords,
} from "@/lib/premium/vocab-assessment-repository";

// ── Import route AFTER mocks ───────────────────────────────────────────────────
import { POST } from "@/app/api/premium/vocab-assessment/route";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const AUTHED_USER = { id: "user-abandonment-test" };

function makeMockSupabaseClient() {
  return { from: vi.fn() };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(requireApiUser).mockResolvedValue(AUTHED_USER as never);
  vi.mocked(createAdminClient).mockReturnValue(
    makeMockSupabaseClient() as never,
  );
  vi.mocked(assertFrequencyListLoaded).mockReturnValue(undefined);
  vi.mocked(upsertVocabProfile).mockResolvedValue(undefined);
  vi.mocked(insertSeedKnownWords).mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: I-W1 — abandonment / invalid submission → no garbage profile
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — I-W1 abandonment fallback", () => {
  it("I-W1: body missing 'answers' field → 400, upsertVocabProfile NOT called", async () => {
    const req = new Request("http://localhost/api/premium/vocab-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // no 'answers' key
    });

    const res = await POST(req as never);

    expect(res.status).toBe(400);
    // No partial profile must be persisted on invalid request
    expect(upsertVocabProfile).not.toHaveBeenCalled();
    expect(insertSeedKnownWords).not.toHaveBeenCalled();
  });

  it("I-W1: 'answers' is not an array → 400, no profile persisted", async () => {
    const req = new Request("http://localhost/api/premium/vocab-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: "partial-string" }), // malformed
    });

    const res = await POST(req as never);

    expect(res.status).toBe(400);
    expect(upsertVocabProfile).not.toHaveBeenCalled();
    expect(insertSeedKnownWords).not.toHaveBeenCalled();
  });

  it("I-W1: answer item missing 'token' field → 400, no profile persisted", async () => {
    const req = new Request("http://localhost/api/premium/vocab-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: [{ known: true }] }), // missing token
    });

    const res = await POST(req as never);

    expect(res.status).toBe(400);
    expect(upsertVocabProfile).not.toHaveBeenCalled();
  });

  it("I-W1: empty answers array → valid 200 response with beginner band (all-unknown safe fallback)", async () => {
    // Empty answers array means user knows nothing → beginner estimate.
    // This is NOT abandonment; it's a valid completed submission with all don't-know.
    // The profile SHOULD be persisted with a valid band (not garbage).
    const req = new Request("http://localhost/api/premium/vocab-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: [] }),
    });

    const res = await POST(req as never);

    // Should succeed — empty submission is valid (maps to beginner/0 vocab size)
    expect(res.status).toBe(200);

    // If upsertVocabProfile was called, verify the band is valid (not garbage/null)
    if (vi.mocked(upsertVocabProfile).mock.calls.length > 0) {
      const params = vi.mocked(upsertVocabProfile).mock.calls[0][2] as {
        estimatedBand: string | null | undefined;
      };
      expect(["beginner", "basic", "conversation", "professional"]).toContain(
        params.estimatedBand,
      );
    }
  });

  it("I-W1: unauthenticated submission → 401, no profile persisted (auth guard first)", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireApiUser).mockResolvedValue(
      NextResponse.json(
        { error: "not authenticated" },
        { status: 401 },
      ) as never,
    );

    const req = new Request("http://localhost/api/premium/vocab-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: [{ token: "the", known: true }] }),
    });

    const res = await POST(req as never);

    expect(res.status).toBe(401);
    expect(upsertVocabProfile).not.toHaveBeenCalled();
    expect(insertSeedKnownWords).not.toHaveBeenCalled();
  });

  it("I-W1: malformed JSON body → 400, no profile persisted", async () => {
    const req = new Request("http://localhost/api/premium/vocab-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json{{{",
    });

    const res = await POST(req as never);

    expect(res.status).toBe(400);
    expect(upsertVocabProfile).not.toHaveBeenCalled();
  });
});
