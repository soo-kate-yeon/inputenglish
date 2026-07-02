/**
 * TDD tests for POST /api/premium/onboarding/finalize-band (Task 3.2, SPEC-WEB-001 Phase 3)
 *
 * RED -> GREEN -> REFACTOR
 *
 * REQ-WEB-002-E2/U3, AC-002-2, EC-002-B: cross-validates self-report IL against the
 * vocab-assessment diagnostic band; "lower wins" — NEVER starts higher than the
 * diagnostic estimate when they disagree. Persists the FINAL users.il_index here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireApiUser } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
}));

const { mockFinalizeIlIndex } = vi.hoisted(() => ({
  mockFinalizeIlIndex: vi.fn(),
}));

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: mockRequireApiUser,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/premium/il-onboarding-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/premium/il-onboarding-repository")
  >("@/lib/premium/il-onboarding-repository");
  return {
    ...actual,
    finalizeIlIndex: mockFinalizeIlIndex,
  };
});

import { POST } from "@/app/api/premium/onboarding/finalize-band/route";
import { NextRequest, NextResponse } from "next/server";

const MOCK_USER = { id: "user-finalize-0000-000000000001" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/premium/onboarding/finalize-band",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/premium/onboarding/finalize-band", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue(MOCK_USER);
    mockFinalizeIlIndex.mockImplementation(
      async (
        _client: unknown,
        _userId: string,
        params: {
          selfReportIl: number;
          diagnosticIl: number;
        },
      ) => ({ finalIl: Math.min(params.selfReportIl, params.diagnosticIl) }),
    );
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockRequireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const response = await POST(
      makeRequest({ selfReportIl: 4, estimatedBand: "conversation" }),
    );

    expect(response.status).toBe(401);
    expect(mockFinalizeIlIndex).not.toHaveBeenCalled();
  });

  it("converts the diagnostic VocabBand to an IL-comparable value via the band bridge", async () => {
    // conversation -> levelBandToIlSeed("conversation") === 5.0
    const response = await POST(
      makeRequest({ selfReportIl: 6, estimatedBand: "conversation" }),
    );

    expect(response.status).toBe(200);
    expect(mockFinalizeIlIndex).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      expect.objectContaining({ selfReportIl: 6, diagnosticIl: 5.0 }),
    );
  });

  it("EC-002-B invariant: never starts higher than the diagnostic estimate when they disagree", async () => {
    // self-report says IL 7 (professional), diagnostic says beginner (IL 1.0)
    const response = await POST(
      makeRequest({ selfReportIl: 7, estimatedBand: "beginner" }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.finalIl).toBeLessThanOrEqual(1.0);
    expect(payload.finalIl).toBe(1.0);
  });

  it("uses self-report when it agrees with or is lower than the diagnostic", async () => {
    // self-report IL 2, diagnostic professional (7.0) -> lower wins = self-report
    const response = await POST(
      makeRequest({ selfReportIl: 2, estimatedBand: "professional" }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.finalIl).toBe(2.0);
  });

  it("persists vocabEstimate when provided", async () => {
    await POST(
      makeRequest({
        selfReportIl: 3,
        estimatedBand: "basic",
        vocabEstimate: 900,
      }),
    );

    expect(mockFinalizeIlIndex).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      expect.objectContaining({ vocabEstimate: 900 }),
    );
  });

  it("rejects an invalid estimatedBand with 400", async () => {
    const response = await POST(
      makeRequest({ selfReportIl: 4, estimatedBand: "advanced" }),
    );
    expect(response.status).toBe(400);
    expect(mockFinalizeIlIndex).not.toHaveBeenCalled();
  });

  it("rejects a selfReportIl outside 1-7 with 400", async () => {
    const response = await POST(
      makeRequest({ selfReportIl: 9, estimatedBand: "basic" }),
    );
    expect(response.status).toBe(400);
    expect(mockFinalizeIlIndex).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed request body", async () => {
    const response = await POST(makeRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
    expect(mockFinalizeIlIndex).not.toHaveBeenCalled();
  });
});
