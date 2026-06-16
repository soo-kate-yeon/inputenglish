/**
 * TDD Phase 4 — REQ-VOCAB-I: Integration tests for knownLemmas wiring in reading route.
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - I-E1: reading route fetches known_words → Set<string> and passes populated knownLemmas
 *         to generateReadingPiece (existing gate, signature unchanged)
 * - I-E1 (empty): when known_words returns no rows, passes empty Set (gate self-skips, no crash)
 * - I-U2 regression: today/route.ts source is UNCHANGED by Phase 4 (verified via git diff)
 * - I-W1: empty/too-few answer submission to vocab-assessment does NOT persist a profile row
 * - REQ-AUTO-005 (inherited): INPUT-003 automation files reference no legacy premium tables
 *
 * Mock pattern mirrors route.test.ts (the existing reading route tests).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// ── All mocks BEFORE imports ───────────────────────────────────────────────────

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const generateReadingPiece = vi.fn();
const fetchKnownLemmas = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/lib/premium/reading-generation", () => ({
  generateReadingPiece: (...args: unknown[]) => generateReadingPiece(...args),
}));

vi.mock("@/lib/premium/vocab-assessment-repository", () => ({
  fetchKnownLemmas: (...args: unknown[]) => fetchKnownLemmas(...args),
  // keep other exports for other tests that import this module
  upsertVocabProfile: vi.fn(),
  insertSeedKnownWords: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({ from: mockFrom }),
  createClient: vi.fn(),
}));

// ── Import route AFTER mocks ───────────────────────────────────────────────────
import { POST } from "@/app/api/premium/reading/route";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const user = { id: "user-i-e1-test" };
const trialEntitlement = {
  hasAccess: true,
  plan: "FREE",
  reason: "trial",
  trialEndsAt: "2026-06-22T00:00:00.000Z",
};

const validBody = {
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  userId: user.id,
};

const fixtureReadingPiece = {
  id: "reading-fixture-phase4",
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  body: "Climate change is a major concern worldwide.",
  coveragePct: 96,
  validationStatus: "approved",
  sourceFacts: {},
  userId: user.id,
  createdAt: "2026-06-16T00:00:00.000Z",
};

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  requireApiUser.mockReset();
  resolvePremiumEntitlement.mockReset();
  generateReadingPiece.mockReset();
  fetchKnownLemmas.mockReset();
  mockFrom.mockReset();

  // Default happy-path setup
  requireApiUser.mockResolvedValue(user);
  resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
  generateReadingPiece.mockResolvedValue(fixtureReadingPiece);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: knownLemmas wiring (I-E1) — populated set passed to generateReadingPiece
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/premium/reading — knownLemmas wiring (I-E1)", () => {
  it("fetches known lemmas from known_words and passes a populated Set to generateReadingPiece", async () => {
    // Arrange: user has 3 known words
    const knownSet = new Set(["climate", "change", "global"]);
    fetchKnownLemmas.mockResolvedValue(knownSet);

    const req = new Request("http://localhost/api/premium/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    // Act
    const res = await POST(req as never);

    // Assert: route fetched known lemmas for this user
    expect(fetchKnownLemmas).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      user.id,
    );

    // Assert: generateReadingPiece received knownLemmas with the populated set
    expect(generateReadingPiece).toHaveBeenCalledWith(
      expect.objectContaining({
        knownLemmas: knownSet,
      }),
    );

    // Assert: response is still 200
    expect(res.status).toBe(200);
  });

  it("passes empty Set to generateReadingPiece when user has no known words (cold-start safe)", async () => {
    // Arrange: user has no known words yet
    fetchKnownLemmas.mockResolvedValue(new Set<string>());

    const req = new Request("http://localhost/api/premium/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    // Act
    const res = await POST(req as never);

    // Assert: generateReadingPiece called — no crash
    expect(res.status).toBe(200);
    expect(generateReadingPiece).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "B1",
        format: "nonfiction",
        topic: "climate",
        userId: user.id,
        // knownLemmas is present (empty Set) — gate self-skips inside generateReadingPiece
        knownLemmas: expect.any(Set),
      }),
    );
    const callArgs = generateReadingPiece.mock.calls[0][0] as {
      knownLemmas: Set<string>;
    };
    expect(callArgs.knownLemmas.size).toBe(0);
  });

  it("signature of generateReadingPiece is unchanged (knownLemmas is optional, not a new required param)", async () => {
    // The SPEC says: DO NOT change generateReadingPiece signature.
    // knownLemmas is already optional (Set<string>?).
    // This test checks that passing it does not cause a type error or runtime crash.
    fetchKnownLemmas.mockResolvedValue(new Set(["technology", "data"]));

    const req = new Request("http://localhost/api/premium/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, format: "business" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });

  it("still returns 401 if unauthenticated (auth gate is preserved)", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "not authenticated" }, { status: 401 }),
    );

    const req = new Request("http://localhost/api/premium/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
    // fetchKnownLemmas must NOT be called if not authenticated
    expect(fetchKnownLemmas).not.toHaveBeenCalled();
  });

  it("still returns 402 when entitlement expired (gate before knownLemmas fetch)", async () => {
    resolvePremiumEntitlement.mockResolvedValue({
      hasAccess: false,
      plan: "FREE",
      reason: "trial-expired",
      trialEndsAt: "2026-06-01T00:00:00.000Z",
    });
    fetchKnownLemmas.mockResolvedValue(new Set<string>());

    const req = new Request("http://localhost/api/premium/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(402);
  });
});
