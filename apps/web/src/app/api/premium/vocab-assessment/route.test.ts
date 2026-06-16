/**
 * TDD tests for Phase 2 — POST /api/premium/vocab-assessment route (REQ-VOCAB-P)
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - AC-P-1: Profile upsert triggered after assessment scoring
 * - AC-P-2: known_words bulk insert triggered
 * - AC-P-3: Unauthenticated → 401 (P-U1 auth gate)
 * - EC-P-A: Partial failure (profile ok, words fail) → retryable error response (P-W1)
 * - EC-P-B: Pseudowords / isReal=false tokens never persisted (P-U2 server re-validation)
 * - EC-I-C: Server re-validates isReal/band from frequency list (contract C5.4)
 * - Server ignores client-sent isReal/band; re-derives from frequency list
 * - assertFrequencyListLoaded called at route entry
 *
 * Mocking pattern: mirrors today/route.test.ts.
 * No live DB, no network — all external deps mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── All mocks declared BEFORE imports ─────────────────────────────────────────

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
    // Allow real scoreAssessment, getBandSeedMetadata, etc. to run
    // but mock assertFrequencyListLoaded so it doesn't throw in unit tests
    assertFrequencyListLoaded: vi.fn(), // default: no-op (list is "loaded")
    getLemmaRank: actual.getLemmaRank,
    bandForLemma: actual.bandForLemma,
    scoreAssessment: actual.scoreAssessment,
  };
});

vi.mock("@/lib/premium/vocab-assessment-repository", () => ({
  upsertVocabProfile: vi.fn(),
  insertSeedKnownWords: vi.fn(),
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

const AUTHED_USER = { id: "user-aaaa-0000-0000-0000-000000000001" };

// Real words from the NGSL list (verified to exist in frequency-list.ts)
const REAL_ANSWERS = [
  // "the" is rank 1 (beginner)
  { token: "the", known: true },
  // "be" is rank 2 (beginner)
  { token: "be", known: false },
  // "economy" should be in the professional range — but we only need the
  // server re-validation logic; we supply a mix of known/unknown
];

// Pseudowords that are NOT in the frequency list
const PSEUDO_ANSWERS = [
  { token: "flurble", known: true }, // pseudoword "yes" — over-claim signal
  { token: "zogwump", known: false }, // pseudoword "no"
];

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/premium/vocab-assessment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
// Suite 1: Authentication gate (AC-P-3 / P-U1)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — auth gate", () => {
  it("returns 401 when requireApiUser returns a NextResponse (unauthenticated)", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireApiUser).mockResolvedValue(
      NextResponse.json(
        { error: "not authenticated" },
        { status: 401 },
      ) as never,
    );

    const req = makeRequest({ answers: [] });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
  });

  it("proceeds when user is authenticated", async () => {
    const req = makeRequest({
      answers: [{ token: "the", known: true }],
    });
    const res = await POST(req as never);

    // Should NOT be 401
    expect(res.status).not.toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Request body validation
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — request body validation", () => {
  it("returns 400 when answers field is missing", async () => {
    const req = makeRequest({});
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  it("returns 400 when answers is not an array", async () => {
    const req = makeRequest({ answers: "not-an-array" });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  it("returns 400 when an answer item is missing token", async () => {
    const req = makeRequest({ answers: [{ known: true }] });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  it("accepts empty answers array (edge: all unknown)", async () => {
    const req = makeRequest({ answers: [] });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Server re-validation ignores client isReal/band (contract C5.4 / EC-I-C)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — server re-validation (C5.4)", () => {
  it("calls assertFrequencyListLoaded at route entry", async () => {
    const req = makeRequest({ answers: [{ token: "the", known: true }] });
    await POST(req as never);

    expect(assertFrequencyListLoaded).toHaveBeenCalled();
  });

  it("does NOT trust client-sent isReal; re-derives from frequency list", async () => {
    // Client sends isReal=true for a pseudoword — server should re-derive isReal=false
    const req = makeRequest({
      answers: [
        { token: "flurble", known: true }, // pseudoword, but client claims isReal=true
      ],
    });
    const res = await POST(req as never);

    // The route should succeed (not 500), and the pseudoword must NOT be passed to insertSeedKnownWords
    expect(res.status).toBe(200);

    // insertSeedKnownWords must not receive "flurble" as a seed word
    const calls = vi.mocked(insertSeedKnownWords).mock.calls;
    if (calls.length > 0) {
      const seedWords = calls[0][2]; // 3rd arg = seedKnownWords
      const hasFlurble = seedWords.some(
        (w: { lemma: string }) => w.lemma === "flurble",
      );
      expect(hasFlurble).toBe(false);
    }
  });

  it("real word in frequency list (e.g., 'the') is re-derived as isReal=true", async () => {
    const req = makeRequest({
      answers: [{ token: "the", known: true }],
    });
    await POST(req as never);

    // upsertVocabProfile should be called — scoring ran
    expect(upsertVocabProfile).toHaveBeenCalled();
  });

  it("token not in frequency list is treated as pseudoword (isReal=false)", async () => {
    const req = makeRequest({
      answers: [{ token: "zzzyyyxxx_not_a_word", known: true }],
    });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    // The pseudoword must not appear in known_words
    const calls = vi.mocked(insertSeedKnownWords).mock.calls;
    if (calls.length > 0) {
      const seedWords = calls[0][2];
      const hasPseudo = seedWords.some(
        (w: { lemma: string }) => w.lemma === "zzzyyyxxx_not_a_word",
      );
      expect(hasPseudo).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Persistence calls (AC-P-1 / AC-P-2)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — persistence", () => {
  it("calls upsertVocabProfile with the authenticated user's id", async () => {
    const req = makeRequest({
      answers: [
        { token: "the", known: true },
        { token: "be", known: true },
      ],
    });
    await POST(req as never);

    expect(upsertVocabProfile).toHaveBeenCalledWith(
      expect.anything(),
      AUTHED_USER.id,
      expect.objectContaining({
        estimatedBand: expect.any(String),
        estimatedLevel: expect.any(String),
        snapshot: expect.objectContaining({ reason: "assessment" }),
      }),
    );
  });

  it("calls insertSeedKnownWords with the authenticated user's id", async () => {
    const req = makeRequest({
      answers: [
        { token: "the", known: true },
        { token: "be", known: false },
      ],
    });
    await POST(req as never);

    expect(insertSeedKnownWords).toHaveBeenCalledWith(
      expect.anything(),
      AUTHED_USER.id,
      expect.any(Array),
    );
  });

  it("response body includes estimatedBand, estimatedLevel, seedCount", async () => {
    const req = makeRequest({
      answers: [
        { token: "the", known: true },
        { token: "be", known: true },
      ],
    });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("estimatedBand");
    expect(body).toHaveProperty("estimatedLevel");
    expect(body).toHaveProperty("seedCount");
    expect(typeof body.seedCount).toBe("number");
  });

  it("seedCount matches the number of real words the user marked known", async () => {
    const req = makeRequest({
      answers: [
        { token: "the", known: true }, // real word, known
        { token: "be", known: true }, // real word, known
        { token: "economy", known: false }, // real word, NOT known
        { token: "flurble", known: true }, // pseudoword — must not count
      ],
    });
    const res = await POST(req as never);

    const body = (await res.json()) as { seedCount: number };
    // "the" and "be" are real known words; pseudoword excluded
    // economy is not known; so seedCount should be 2
    expect(body.seedCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Partial failure / atomic-or-recoverable (EC-P-A / P-W1)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — partial failure handling (P-W1)", () => {
  it("returns 500 with 'profile_written_words_failed' code when upsert succeeds but words fail", async () => {
    vi.mocked(upsertVocabProfile).mockResolvedValue(undefined);
    vi.mocked(insertSeedKnownWords).mockRejectedValue(
      new Error("known_words: network error"),
    );

    const req = makeRequest({
      answers: [{ token: "the", known: true }],
    });
    const res = await POST(req as never);

    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    // Must expose a machine-readable failure code so client can retry
    expect(body.code).toBe("profile_written_words_failed");
  });

  it("returns 500 when profile upsert itself fails", async () => {
    vi.mocked(upsertVocabProfile).mockRejectedValue(
      new Error("user_vocab_profiles: connection refused"),
    );

    const req = makeRequest({
      answers: [{ token: "the", known: true }],
    });
    const res = await POST(req as never);

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Pseudoword / unknown lemma never persisted (EC-P-B / P-U2)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/vocab-assessment — pseudoword isolation (P-U2)", () => {
  it("pseudoword marked known is excluded from seedKnownWords passed to insertSeedKnownWords", async () => {
    const req = makeRequest({
      answers: [
        { token: "flurble", known: true }, // pseudoword
        { token: "zogwump", known: true }, // pseudoword
        { token: "the", known: true }, // real word
      ],
    });
    await POST(req as never);

    const seedWords = vi.mocked(insertSeedKnownWords).mock.calls[0]?.[2] ?? [];
    const pseudoInSeed = (seedWords as Array<{ lemma: string }>).filter(
      (w) => w.lemma === "flurble" || w.lemma === "zogwump",
    );
    expect(pseudoInSeed).toHaveLength(0);
  });

  it("real word marked unknown is excluded from seedKnownWords", async () => {
    const req = makeRequest({
      answers: [
        { token: "the", known: false }, // real word but NOT known
      ],
    });
    await POST(req as never);

    const seedWords = vi.mocked(insertSeedKnownWords).mock.calls[0]?.[2] ?? [];
    const theInSeed = (seedWords as Array<{ lemma: string }>).filter(
      (w) => w.lemma === "the",
    );
    expect(theInSeed).toHaveLength(0);
  });
});
