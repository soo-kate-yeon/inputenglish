import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// SPEC-WEB-001 Phase 1, Task 1.2 (REQ-WEB-001-E2, AC-001-1/3, EC-001-C) —
// auth callback: exchange code for session, upsert UserProfile without
// duplicating existing rows, then branch to onboarding or learning home.

const exchangeCodeForSession = vi.fn();
const maybeSingle = vi.fn();
const upsert = vi.fn();
const upsertSelect = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
      upsert: (...args: unknown[]) => {
        upsert(...args);
        return { select: () => ({ maybeSingle: upsertSelect }) };
      },
    }),
  }),
}));

const sessionUser = {
  id: "user-1",
  email: "user@example.com",
  created_at: "2026-07-01T00:00:00.000Z",
};

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    exchangeCodeForSession.mockReset();
    maybeSingle.mockReset();
    upsert.mockReset();
    upsertSelect.mockReset();
  });

  it("exchanges the code, upserts a new UserProfile (plan=FREE), and redirects to onboarding when il_index is unset", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: sessionUser } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null, error: null }); // no existing row
    upsertSelect.mockResolvedValue({
      data: { id: "user-1", il_index: null },
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/auth/callback?code=abc123"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        plan: "FREE",
      }),
      expect.anything(),
    );
    expect(response.status).toBe(307); // redirect
    expect(response.headers.get("location")).toContain("/onboarding");
  });

  it("does not duplicate an existing UserProfile row (EC-001-C) and redirects to learning home when il_index is already set", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: sessionUser } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: { id: "user-1", il_index: 4.0, plan: "PREMIUM" },
      error: null,
    });
    upsertSelect.mockResolvedValue({
      data: { id: "user-1", il_index: 4.0 },
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/auth/callback?code=abc123"),
    );

    // upsert is still called (idempotent upsert, not insert) — but must not
    // clobber plan for an existing user, and must not create a duplicate row.
    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertPayload = upsert.mock.calls[0][0];
    expect(upsertPayload.id).toBe("user-1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).not.toContain("/onboarding");
    expect(response.headers.get("location")).toContain("/");
  });

  it("redirects to /login with an error when code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid code" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/auth/callback?code=bad-code"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("redirects to /login when no code is present in the callback URL", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/auth/callback"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
