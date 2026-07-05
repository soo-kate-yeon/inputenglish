import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// SPEC-WEB-001 Phase 1, Task 1.3 (REQ-WEB-001-W1, AC-NFR-3, EC-001-A) —
// extends middleware to redirect unauthenticated learning/billing/account
// route access to /login, while the existing /api passthrough and cookie
// refresh logic (INVIOLABLE KEEP) must remain unchanged (regression tests).

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
  }),
}));

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

describe("updateSession middleware", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  describe("regression: existing behavior must be unchanged (AC-NFR-3)", () => {
    it("allows /api routes through without authentication (unchanged passthrough)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/api/premium/today"));

      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
    });

    it("allows unauthenticated access to /auth/* (unchanged)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/auth/callback"));

      expect(response.headers.get("location")).toBeNull();
    });

    it("allows unauthenticated access to / (unchanged)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/"));

      expect(response.headers.get("location")).toBeNull();
    });

    it("allows unauthenticated access to /home (unchanged)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/home"));

      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects unauthenticated access to an arbitrary unlisted path to /home (unchanged legacy fallback)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/some-legacy-page"));

      expect(response.headers.get("location")).toContain("/home");
    });

    it("does not redirect authenticated users away from protected paths (unchanged)", async () => {
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/some-legacy-page"));

      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("regression: public unauthenticated entry points must stay reachable", () => {
    it.each(["/login", "/onboarding", "/privacy", "/support", "/terms"])(
      "does not redirect unauthenticated access to %s",
      async (publicPath) => {
        getUser.mockResolvedValue({ data: { user: null } });

        const { updateSession } = await import("../middleware");
        const response = await updateSession(makeRequest(publicPath));

        expect(response.headers.get("location")).toBeNull();
      },
    );
  });

  describe("extension: learning/billing/account protected routes redirect to /login (EC-001-A)", () => {
    it.each(["/learning", "/billing", "/account"])(
      "redirects unauthenticated access to %s to /login",
      async (protectedPath) => {
        getUser.mockResolvedValue({ data: { user: null } });

        const { updateSession } = await import("../middleware");
        const response = await updateSession(makeRequest(protectedPath));

        expect(response.headers.get("location")).toContain("/login");
      },
    );

    it("redirects unauthenticated access to nested protected sub-paths to /login", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/learning/today"));

      expect(response.headers.get("location")).toContain("/login");
    });

    it("allows authenticated users through protected routes without redirect", async () => {
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { updateSession } = await import("../middleware");
      const response = await updateSession(makeRequest("/learning"));

      expect(response.headers.get("location")).toBeNull();
    });
  });
});
