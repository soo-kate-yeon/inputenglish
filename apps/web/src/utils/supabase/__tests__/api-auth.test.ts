import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// SPEC-WEB-001 Phase 1, Task 1.0 (gates Task 1.4) — proves whether the existing
// cookie-session fallback in requireApiUser (api-auth.ts:232-258) already
// authenticates SSR web sessions, without regressing the existing mobile
// Bearer-token path (api-auth.ts:182-230).
//
// Reference: spec.md "Critical pre-finding" — requireApiUser checks Authorization:
// Bearer first, and falls back to createClient() (SSR cookie client) + getUser()
// when no Bearer header is present. This is architecturally identical to what an
// SSR cookie session needs, so this test empirically confirms the fallback works
// end-to-end at the requireApiUser level (unit boundary — createClient/createAdminClient mocked).

const adminGetUser = vi.fn();
const cookieGetUser = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({
    auth: { getUser: adminGetUser },
  }),
  createClient: () => ({
    auth: { getUser: cookieGetUser },
  }),
}));

describe("requireApiUser — SSR cookie session gate (Task 1.0)", () => {
  beforeEach(() => {
    adminGetUser.mockReset();
    cookieGetUser.mockReset();
  });

  describe("Bearer token path (existing mobile client — must not regress)", () => {
    it("accepts a valid bearer token via the admin client", async () => {
      adminGetUser.mockResolvedValue({
        data: { user: { id: "mobile-user-1" } },
        error: null,
      });

      const { requireApiUser } = await import("../api-auth");
      const request = new NextRequest("http://localhost/api/premium/today", {
        headers: { authorization: "Bearer valid-mobile-token" },
      });

      const result = await requireApiUser(request);

      expect(adminGetUser).toHaveBeenCalledWith("valid-mobile-token");
      expect(cookieGetUser).not.toHaveBeenCalled();
      expect(result).not.toBeInstanceOf(Response);
      expect((result as { id: string }).id).toBe("mobile-user-1");
    });

    it("rejects an empty bearer token with 401 before touching the admin client", async () => {
      const { requireApiUser } = await import("../api-auth");
      // The Fetch Headers API normalizes away trailing whitespace, so a literal
      // "Bearer " cannot be constructed via NextRequest's headers option. This
      // exercises the same code path (authorization.startsWith("Bearer ") with
      // an empty token remainder) using a minimal request-shaped stub instead.
      const request = {
        headers: {
          get: (name: string) => (name === "authorization" ? "Bearer " : null),
        },
        nextUrl: { pathname: "/api/premium/today" },
      } as unknown as NextRequest;

      const result = await requireApiUser(request);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
      expect(adminGetUser).not.toHaveBeenCalled();
    });

    it("rejects an invalid bearer token with 401", async () => {
      adminGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "invalid token" },
      });

      const { requireApiUser } = await import("../api-auth");
      const request = new NextRequest("http://localhost/api/premium/today", {
        headers: { authorization: "Bearer bad-token" },
      });

      const result = await requireApiUser(request);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });
  });

  describe("Cookie session path (SSR web — Task 1.0 gate outcome)", () => {
    it("authenticates a request with NO Authorization header via the SSR cookie client (proves cookie session already works)", async () => {
      cookieGetUser.mockResolvedValue({
        data: { user: { id: "web-user-1" } },
        error: null,
      });

      const { requireApiUser } = await import("../api-auth");
      const request = new NextRequest("http://localhost/api/premium/today");

      const result = await requireApiUser(request);

      expect(adminGetUser).not.toHaveBeenCalled();
      expect(cookieGetUser).toHaveBeenCalledTimes(1);
      expect(result).not.toBeInstanceOf(Response);
      expect((result as { id: string }).id).toBe("web-user-1");
    });

    it("returns 401 (not content) when the cookie session is missing or invalid", async () => {
      cookieGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "no session" },
      });

      const { requireApiUser } = await import("../api-auth");
      const request = new NextRequest("http://localhost/api/premium/today");

      const result = await requireApiUser(request);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });
  });
});
