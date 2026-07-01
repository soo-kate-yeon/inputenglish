import { beforeEach, describe, expect, it, vi } from "vitest";

// SPEC-WEB-001 Phase 1, Task 1.0 — route-level proof that /api/premium/today
// authenticates via SSR cookie session (no Authorization header) through the
// real requireApiUser implementation, not a mocked stand-in. Only the Supabase
// clients underneath requireApiUser/entitlement/session-assembly are mocked.
//
// Outcome informs Task 1.4: if this test passes without any change to
// api-auth.ts, adding a redundant cookie auth path would be a no-op.

const cookieGetUser = vi.fn();
const adminGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: cookieGetUser },
  }),
  createAdminClient: () => ({
    auth: { getUser: adminGetUser },
    from: mockFrom,
  }),
}));

function tableStub(row: Record<string, unknown> | null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row, error: null }),
      }),
    }),
  };
}

describe("GET /api/premium/today — SSR cookie session (Task 1.0 gate)", () => {
  beforeEach(() => {
    vi.resetModules();
    cookieGetUser.mockReset();
    adminGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("authenticates via cookie session (no Authorization header) and reaches entitlement resolution instead of 401", async () => {
    cookieGetUser.mockResolvedValue({
      data: { user: { id: "web-user-1", created_at: "2020-01-01T00:00:00Z" } },
      error: null,
    });

    // users.plan lookup used by resolvePremiumEntitlement — FREE + old created_at
    // means trial-expired, which is fine: we only assert we got PAST auth (402,
    // not 401), proving the cookie session was accepted.
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return tableStub({ plan: "FREE", created_at: "2020-01-01T00:00:00Z" });
      }
      return tableStub(null);
    });

    const { GET } = await import("../today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(cookieGetUser).toHaveBeenCalledTimes(1);
    expect(adminGetUser).not.toHaveBeenCalled();
    // 401 would mean auth failed; 402 (entitlement) or 200 both prove auth succeeded.
    expect(response.status).not.toBe(401);
    expect(response.status).toBe(402);
  });

  it("still returns 401 when the cookie session is missing (regression: unauthenticated must stay blocked)", async () => {
    cookieGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "no session" },
    });

    const { GET } = await import("../today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(401);
  });
});
