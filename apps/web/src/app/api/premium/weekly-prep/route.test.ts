/**
 * SPEC-WEB-001 Phase 6 — Task 6.2: GET /api/premium/weekly-prep — read-only,
 * RLS-scoped listing of the authenticated user's own latest WeeklyPrep
 * (REQ-WEB-006-U1, AC-006-2). Web delivery + PDF export happens client-side
 * via window.print() (WeeklyPrepView) — this route only returns the data.
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

const user = { id: "user-wp-1" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};

describe("GET /api/premium/weekly-prep", () => {
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
      new Request("http://localhost/api/premium/weekly-prep") as never,
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
      new Request("http://localhost/api/premium/weekly-prep") as never,
    );

    expect(response.status).toBe(402);
  });

  it("returns the user's own latest weekly_prep row, scoped by user_id", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);

    const row = {
      id: "wp-1",
      user_id: "user-wp-1",
      week_start_date: "2026-06-28",
      course_id: "course-news",
      vocab: ["resilient", "momentum"],
      expressions: ["build momentum"],
      source_sentences: [
        { text: "The economy is building momentum.", translation: null },
      ],
      send_status: "pending",
      created_at: "2026-06-28T00:00:00.000Z",
    };

    const limitMock = vi.fn().mockResolvedValue({ data: [row], error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    mockFrom.mockImplementation((table: string) => {
      if (table === "weekly_prep") {
        return { select: () => ({ eq: eqMock }) };
      }
      return { select: () => ({ eq: () => ({}) }) };
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/weekly-prep") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      weeklyPrep: {
        id: string;
        vocab: string[];
        expressions: string[];
        sourceSentences: { text: string }[];
        sendStatus: string;
      } | null;
    };
    expect(body.weeklyPrep?.id).toBe("wp-1");
    expect(body.weeklyPrep?.vocab).toEqual(["resilient", "momentum"]);
    expect(body.weeklyPrep?.sourceSentences).toHaveLength(1);
    expect(body.weeklyPrep?.sendStatus).toBe("pending");
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-wp-1");
  });

  it("returns weeklyPrep: null (not 404) when the user has no WeeklyPrep yet", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);

    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    mockFrom.mockImplementation(() => ({ select: () => ({ eq: eqMock }) }));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/weekly-prep") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { weeklyPrep: unknown };
    expect(body.weeklyPrep).toBeNull();
  });

  it("returns 500 with an error message on a database error", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);

    const limitMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "db down" } });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    mockFrom.mockImplementation(() => ({ select: () => ({ eq: eqMock }) }));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/weekly-prep") as never,
    );

    expect(response.status).toBe(500);
  });
});
