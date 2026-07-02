/**
 * SPEC-WEB-001 Phase 6 — Task 6.2: client-side GET helper for
 * /api/premium/weekly-prep, feeding WeeklyPrepView (REQ-WEB-006-U1, AC-006-2).
 * Mirrors fetch-asked-items.ts / fetch-today-session.ts's { status, body }
 * shape — never throws on non-2xx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWeeklyPrep } from "../fetch-weekly-prep";

describe("fetchWeeklyPrep", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns { status: 200, body } with the weeklyPrep payload", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      json: async () => ({
        weeklyPrep: {
          id: "wp-1",
          vocab: ["resilient"],
          expressions: ["build momentum"],
          sourceSentences: [{ text: "...", translation: null }],
          sendStatus: "pending",
        },
      }),
    });

    const result = await fetchWeeklyPrep();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/premium/weekly-prep",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.status).toBe(200);
    expect(result.body.weeklyPrep?.id).toBe("wp-1");
  });

  it("returns { status: 402, body } for the entitlement gate response without throwing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 402,
      json: async () => ({
        entitlement: { hasAccess: false, plan: "FREE" },
        weeklyPrep: null,
      }),
    });

    const result = await fetchWeeklyPrep();

    expect(result.status).toBe(402);
    expect(result.body.weeklyPrep).toBeNull();
  });

  it("returns { status: 500, body } with an error message without throwing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 500,
      json: async () => ({ error: "boom" }),
    });

    const result = await fetchWeeklyPrep();

    expect(result.status).toBe(500);
    expect(result.body.error).toBe("boom");
  });
});
