/**
 * SPEC-WEB-001 Phase 5 — Task 5.2: client-side GET helper for
 * /api/premium/today, feeding buildLearningHomeViewModel. Mirrors
 * apps/web/src/lib/onboarding/post-json.ts's error semantics but for GET
 * and WITHOUT throwing on non-2xx (402/500 are valid, expected outcomes
 * this flow must render a view for, not throw away).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchTodaySession } from "../fetch-today-session";

describe("fetchTodaySession", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns { status, body } for a 200 response without throwing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      json: async () => ({ session: { id: "s1" }, remainingQuestionCap: 10 }),
    });

    const result = await fetchTodaySession();

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      session: { id: "s1" },
      remainingQuestionCap: 10,
    });
  });

  it("returns { status: 402, body } for the entitlement gate response without throwing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 402,
      json: async () => ({
        entitlement: { hasAccess: false },
        session: null,
      }),
    });

    const result = await fetchTodaySession();

    expect(result.status).toBe(402);
    expect(
      (result.body as { entitlement: { hasAccess: boolean } }).entitlement
        .hasAccess,
    ).toBe(false);
  });

  it("calls GET /api/premium/today", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      json: async () => ({}),
    });

    await fetchTodaySession();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/premium/today",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
