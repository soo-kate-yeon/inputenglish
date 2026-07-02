/**
 * TDD tests for POST /api/premium/onboarding/band-seed (Task 3.1, SPEC-WEB-001 Phase 3)
 *
 * RED -> GREEN -> REFACTOR
 *
 * REQ-WEB-002-E1, AC-002-1: choosing "comfortable" on the IL 4 card -> IL seed = 4.0.
 * Mocking pattern mirrors vocab-signal/route.test.ts (vi.hoisted for cross-mock refs).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireApiUser } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
}));

const { mockWriteIlSeed } = vi.hoisted(() => ({
  mockWriteIlSeed: vi.fn(),
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
    writeIlSeed: mockWriteIlSeed,
  };
});

import { POST } from "@/app/api/premium/onboarding/band-seed/route";
import { NextRequest, NextResponse } from "next/server";

const MOCK_USER = { id: "user-band-seed-0000-000000000001" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/premium/onboarding/band-seed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/premium/onboarding/band-seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue(MOCK_USER);
    mockWriteIlSeed.mockResolvedValue(undefined);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockRequireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const response = await POST(makeRequest({ il: 4, choice: "comfortable" }));

    expect(response.status).toBe(401);
    expect(mockWriteIlSeed).not.toHaveBeenCalled();
  });

  it("records IL seed = 4.0 when the user picks 'comfortable' on the IL 4 card (AC-002-1)", async () => {
    const response = await POST(makeRequest({ il: 4, choice: "comfortable" }));

    expect(response.status).toBe(200);
    expect(mockWriteIlSeed).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      4.0,
    );
  });

  it("seeds one band lower when the user picks 'overwhelming' (EC-002-A)", async () => {
    const response = await POST(makeRequest({ il: 4, choice: "overwhelming" }));

    expect(response.status).toBe(200);
    expect(mockWriteIlSeed).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      3.0,
    );
  });

  it("clamps the overwhelming seed at IL 1 (never below the floor)", async () => {
    const response = await POST(makeRequest({ il: 1, choice: "overwhelming" }));

    expect(response.status).toBe(200);
    expect(mockWriteIlSeed).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      1.0,
    );
  });

  it("rejects an il value outside 1-7 with 400", async () => {
    const response = await POST(makeRequest({ il: 8, choice: "comfortable" }));

    expect(response.status).toBe(400);
    expect(mockWriteIlSeed).not.toHaveBeenCalled();
  });

  it("rejects an invalid choice value with 400", async () => {
    const response = await POST(makeRequest({ il: 4, choice: "meh" }));

    expect(response.status).toBe(400);
    expect(mockWriteIlSeed).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed request body", async () => {
    const response = await POST(makeRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
    expect(mockWriteIlSeed).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/premium/onboarding/band-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});
