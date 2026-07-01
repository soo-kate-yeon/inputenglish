import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUser = vi.fn();
const userUpdateEq = vi.fn();
const userUpdate = vi.fn(() => ({ eq: userUpdateEq }));
const from = vi.fn((table: string) => {
  if (table !== "users") throw new Error(`Unexpected table ${table}`);
  return { update: userUpdate };
});

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ from })),
}));

const user = { id: "user-1" };

describe("POST /api/premium/entitlement/sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.REVENUECAT_SECRET_API_KEY;
    delete process.env.REVENUECAT_API_BASE_URL;
    requireApiUser.mockReset();
    from.mockClear();
    userUpdate.mockClear();
    userUpdateEq.mockReset();
    userUpdateEq.mockResolvedValue({ error: null });
  });

  it("rejects unauthenticated entitlement sync requests", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const { POST } = await import("./sync/route");
    const response = await POST(
      new Request("http://localhost/api/premium/entitlement/sync", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("requires a server-side RevenueCat secret key", async () => {
    requireApiUser.mockResolvedValue(user);

    const { POST } = await import("./sync/route");
    const response = await POST(
      new Request("http://localhost/api/premium/entitlement/sync", {
        method: "POST",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe("REVENUECAT_SECRET_API_KEY is not configured");
    expect(from).not.toHaveBeenCalled();
  });

  it("verifies RevenueCat before writing PREMIUM server entitlement", async () => {
    requireApiUser.mockResolvedValue(user);
    process.env.REVENUECAT_SECRET_API_KEY = "rc-secret";
    // Use an expiry relative to "now" (not a hardcoded date) so this test does
    // not silently start failing once the wall clock passes a fixed date.
    const futureExpiry = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscriber: {
          entitlements: {
            premium: {
              expires_date: futureExpiry,
            },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./sync/route");
    const response = await POST(
      new Request("http://localhost/api/premium/entitlement/sync", {
        method: "POST",
        body: JSON.stringify({ plan: "PREMIUM" }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({
      plan: "PREMIUM",
      activeEntitlementIds: ["premium"],
      source: "revenuecat",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.revenuecat.com/v1/subscribers/user-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer rc-secret",
        }),
      }),
    );
    expect(userUpdate).toHaveBeenCalledWith({ plan: "PREMIUM" });
    expect(userUpdateEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("does not trust client-provided PREMIUM when RevenueCat has no active entitlement", async () => {
    requireApiUser.mockResolvedValue(user);
    process.env.REVENUECAT_SECRET_API_KEY = "rc-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              premium: {
                expires_date: "2026-01-01T00:00:00Z",
              },
            },
          },
        }),
      }),
    );

    const { POST } = await import("./sync/route");
    const response = await POST(
      new Request("http://localhost/api/premium/entitlement/sync", {
        method: "POST",
        body: JSON.stringify({ plan: "PREMIUM" }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.plan).toBe("FREE");
    expect(payload.activeEntitlementIds).toEqual([]);
    expect(userUpdate).toHaveBeenCalledWith({ plan: "FREE" });
  });
});
