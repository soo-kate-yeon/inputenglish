import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const generateReadingPiece = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/lib/premium/reading-generation", () => ({
  generateReadingPiece: (...args: unknown[]) => generateReadingPiece(...args),
}));

const user = { id: "user-1" };
const trialEntitlement = {
  hasAccess: true,
  plan: "FREE",
  reason: "trial",
  trialEndsAt: "2026-06-22T00:00:00.000Z",
};
const expiredEntitlement = {
  hasAccess: false,
  plan: "FREE",
  reason: "trial-expired",
  trialEndsAt: "2026-06-08T00:00:00.000Z",
};

const validBody = {
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  userId: "user-1",
};

const fixtureReadingPiece = {
  id: "reading-fixture-1",
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  body: "Climate change is a global challenge that affects every nation.",
  coveragePct: 96,
  validationStatus: "approved",
  sourceFacts: {},
  userId: "user-1",
  createdAt: "2026-06-15T00:00:00.000Z",
};

describe("POST /api/premium/reading", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    generateReadingPiece.mockReset();
  });

  it("returns 401 when request is unauthenticated", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(resolvePremiumEntitlement).not.toHaveBeenCalled();
  });

  it("returns 402 when entitlement is expired", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(402);
    expect(generateReadingPiece).not.toHaveBeenCalled();
  });

  it("returns 400 when request body is missing required fields", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "B1" }),
      }) as never,
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 with reading piece on valid request", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    generateReadingPiece.mockResolvedValue(fixtureReadingPiece);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe("reading-fixture-1");
    expect(payload.body).toBeDefined();
    expect(payload.coveragePct).toBeDefined();
    expect(generateReadingPiece).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "B1",
        format: "nonfiction",
        topic: "climate",
        userId: "user-1",
      }),
    );
  });

  it("disables cache on all responses", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    generateReadingPiece.mockResolvedValue(fixtureReadingPiece);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
