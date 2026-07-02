/**
 * TDD tests for POST /api/premium/il-signal (Task 3.4, SPEC-WEB-001 Phase 3)
 *
 * RED -> GREEN -> REFACTOR
 *
 * New adjacent route (does NOT modify vocab-signal/route.ts, per SPEC constraint) that
 * nudges a continuous users.il_index using the tap-rate hysteresis adapter
 * (il-tap-adjustment.ts), which itself reuses vocab-band-hysteresis.ts primitives.
 * REQ-WEB-002-W1, AC-002-3.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireApiUser } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
}));

const { mockUsersUpdate, mockUsersEq } = vi.hoisted(() => ({
  mockUsersUpdate: vi.fn(),
  mockUsersEq: vi.fn(),
}));

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: mockRequireApiUser,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "users") {
        return { update: mockUsersUpdate };
      }
      throw new Error(`unexpected table access in test: ${table}`);
    },
  }),
}));

import { POST } from "@/app/api/premium/il-signal/route";
import { NextRequest, NextResponse } from "next/server";

const MOCK_USER = { id: "user-il-signal-0000-000000000001" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/premium/il-signal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/premium/il-signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue(MOCK_USER);
    mockUsersEq.mockResolvedValue({ error: null });
    mockUsersUpdate.mockReturnValue({ eq: mockUsersEq });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockRequireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const response = await POST(
      makeRequest({
        currentIl: 4.0,
        tapRate: 0.01,
        voteState: { direction: 0, count: 0 },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("does not persist il_index when the vote has not reached K yet", async () => {
    const response = await POST(
      makeRequest({
        currentIl: 4.0,
        tapRate: 0.01,
        voteState: { direction: 0, count: 0 },
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.nudged).toBe(false);
    expect(payload.newIl).toBe(4.0);
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("AC-002-3: persists a +0.1 nudge once K consecutive too-easy votes accumulate (1% tap rate at IL 4.0)", async () => {
    const response = await POST(
      makeRequest({
        currentIl: 4.0,
        tapRate: 0.01,
        voteState: { direction: 1, count: 2 }, // one more +1 vote reaches K=3
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.nudged).toBe(true);
    expect(payload.newIl).toBeCloseTo(4.1, 5);
    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ il_index: expect.closeTo(4.1, 5) }),
    );
    expect(mockUsersEq).toHaveBeenCalledWith("id", MOCK_USER.id);
  });

  it("clamps the persisted il_index within [1.0, 7.0]", async () => {
    const response = await POST(
      makeRequest({
        currentIl: 7.0,
        tapRate: 0.01,
        voteState: { direction: 1, count: 2 },
      }),
    );

    const payload = await response.json();
    expect(payload.newIl).toBeLessThanOrEqual(7.0);
    expect(payload.newIl).toBe(7.0);
  });

  it("returns 400 for a malformed request body", async () => {
    const response = await POST(makeRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a currentIl outside 1-7", async () => {
    const response = await POST(
      makeRequest({
        currentIl: 8,
        tapRate: 0.01,
        voteState: { direction: 0, count: 0 },
      }),
    );
    expect(response.status).toBe(400);
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });
});
