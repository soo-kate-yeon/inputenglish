/**
 * SPEC-WEB-001 Phase 5 — Task 5.6: GET /api/premium/asked-items — read-only
 * question history listing (REQ-WEB-004-U3, EC-004-C). Reuses the existing
 * AskedItem table/type as-is (SPEC-INPUT-001); this route only lists the
 * authenticated user's own rows, newest first.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({ from: mockFrom }),
  createClient: vi.fn(),
}));

const user = { id: "user-hist-1" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};

describe("GET /api/premium/asked-items", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    mockFrom.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/asked-items") as never,
    );

    expect(response.status).toBe(401);
  });

  it("returns 402 when the user lacks entitlement", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue({
      hasAccess: false,
      plan: "FREE",
      reason: "trial-expired",
      trialEndsAt: null,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/asked-items") as never,
    );

    expect(response.status).toBe(402);
  });

  it("returns the user's own asked_items, newest first, scoped by user_id (EC-004-C: history list only)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);

    const rows = [
      {
        id: "asked-2",
        user_id: "user-hist-1",
        source_type: "segment",
        source_ref: { type: "segment", pieceId: "seg-2" },
        highlight_text: "second highlight",
        question: "q2",
        answer: "a2",
        created_at: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "asked-1",
        user_id: "user-hist-1",
        source_type: "reading",
        source_ref: { type: "reading", pieceId: "reading-1" },
        highlight_text: "first highlight",
        question: "q1",
        answer: "a1",
        created_at: "2026-07-01T00:00:00.000Z",
      },
    ];

    const eqMock = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "asked_items") {
        return { select: () => ({ eq: eqMock }) };
      }
      return { select: () => ({ eq: () => ({}) }) };
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/asked-items") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-hist-1");
  });
});
