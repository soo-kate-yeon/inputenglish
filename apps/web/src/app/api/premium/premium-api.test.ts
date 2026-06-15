import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const fetchTodayPremiumSessionForUser = vi.fn();
const fetchPublishedPremiumSessionById = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/lib/premium/repository", () => ({
  fetchTodayPremiumSessionForUser: (...args: unknown[]) =>
    fetchTodayPremiumSessionForUser(...args),
  fetchPublishedPremiumSessionById: (...args: unknown[]) =>
    fetchPublishedPremiumSessionById(...args),
}));

const user = { id: "user-1" };
const trialEntitlement = {
  hasAccess: true,
  plan: "FREE",
  reason: "trial",
  trialEndsAt: "2026-06-17T00:00:00.000Z",
};
const expiredEntitlement = {
  hasAccess: false,
  plan: "FREE",
  reason: "trial-expired",
  trialEndsAt: "2026-06-08T00:00:00.000Z",
};
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: "2026-06-08T00:00:00.000Z",
};

describe("premium read APIs", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    fetchTodayPremiumSessionForUser.mockReset();
    fetchPublishedPremiumSessionById.mockReset();
  });

  it("rejects unauthenticated premium reads", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const { GET } = await import("./today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(401);
    expect(resolvePremiumEntitlement).not.toHaveBeenCalled();
  });

  it("allows trial users and disables cache", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    fetchTodayPremiumSessionForUser.mockResolvedValue({ id: "session-1" });

    const { GET } = await import("./today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.entitlement.reason).toBe("trial");
    expect(payload.session.id).toBe("session-1");
    expect(fetchTodayPremiumSessionForUser).toHaveBeenCalledWith("user-1");
  });

  it("blocks expired free users even when the client claims premium", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { GET } = await import("./today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today", {
        headers: { "x-client-plan": "PREMIUM" },
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(402);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.entitlement.reason).toBe("trial-expired");
    expect(fetchTodayPremiumSessionForUser).not.toHaveBeenCalled();
  });

  it("gates direct session reads through the same server entitlement", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request("http://localhost/api/premium/sessions/session-1", {
        headers: { "x-client-plan": "PREMIUM" },
      }) as never,
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(402);
    expect(fetchPublishedPremiumSessionById).not.toHaveBeenCalled();
  });

  it("allows trial users to open only today's server-selected session directly", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    fetchTodayPremiumSessionForUser.mockResolvedValue({
      id: "session-today",
      title: "Today",
    });

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/premium/sessions/session-today",
      ) as never,
      { params: Promise.resolve({ sessionId: "session-today" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchTodayPremiumSessionForUser).toHaveBeenCalledWith("user-1");
    expect(fetchPublishedPremiumSessionById).not.toHaveBeenCalled();
    expect(payload.session.id).toBe("session-today");
  });

  it("blocks trial users from opening arbitrary published sessions directly", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    fetchTodayPremiumSessionForUser.mockResolvedValue({
      id: "session-today",
      title: "Today",
    });

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/premium/sessions/session-other",
      ) as never,
      { params: Promise.resolve({ sessionId: "session-other" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Premium session is not today's curation");
    expect(fetchPublishedPremiumSessionById).not.toHaveBeenCalled();
  });

  it("allows premium users to open any published session directly", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    fetchPublishedPremiumSessionById.mockResolvedValue({
      id: "session-other",
      title: "Published",
    });

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/premium/sessions/session-other",
      ) as never,
      { params: Promise.resolve({ sessionId: "session-other" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchTodayPremiumSessionForUser).not.toHaveBeenCalled();
    expect(fetchPublishedPremiumSessionById).toHaveBeenCalledWith(
      "session-other",
    );
    expect(payload.session.id).toBe("session-other");
  });
});
