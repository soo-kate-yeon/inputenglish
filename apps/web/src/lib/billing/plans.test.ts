/**
 * TDD tests for Task 2.1 — Server-side price/plan constants (SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers:
 * - PLAN_PRICES_KRW: single source of truth for server-side price verification
 * - computeExpiryDate: plan-duration expiry computation (annual/semiannual/quarterly)
 */
import { describe, expect, it } from "vitest";
import {
  PLAN_PRICES_KRW,
  computeExpiryDate,
  isValidPlanType,
  type PlanType,
} from "./plans";

describe("PLAN_PRICES_KRW", () => {
  it("defines the exact PRD v1.4 prices for all three plan types", () => {
    expect(PLAN_PRICES_KRW).toEqual({
      annual: 79000,
      semiannual: 49000,
      quarterly: 29000,
    });
  });

  it("has no plan types beyond annual/semiannual/quarterly", () => {
    expect(Object.keys(PLAN_PRICES_KRW).sort()).toEqual([
      "annual",
      "quarterly",
      "semiannual",
    ]);
  });
});

describe("isValidPlanType", () => {
  it("returns true for each of the three known plan types", () => {
    expect(isValidPlanType("annual")).toBe(true);
    expect(isValidPlanType("semiannual")).toBe(true);
    expect(isValidPlanType("quarterly")).toBe(true);
  });

  it("returns false for unknown or malformed values", () => {
    expect(isValidPlanType("monthly")).toBe(false);
    expect(isValidPlanType("")).toBe(false);
    expect(isValidPlanType(undefined)).toBe(false);
    expect(isValidPlanType(null)).toBe(false);
    expect(isValidPlanType(123)).toBe(false);
  });
});

describe("computeExpiryDate", () => {
  const START = new Date("2026-07-01T00:00:00.000Z");

  it("adds 1 year for the annual plan", () => {
    const expiry = computeExpiryDate("annual", START);
    expect(expiry.toISOString()).toBe("2027-07-01T00:00:00.000Z");
  });

  it("adds 6 months for the semiannual plan", () => {
    const expiry = computeExpiryDate("semiannual", START);
    expect(expiry.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("adds 3 months for the quarterly plan", () => {
    const expiry = computeExpiryDate("quarterly", START);
    expect(expiry.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("handles month-end overflow correctly (e.g. Jan 31 + 1 month-based plan)", () => {
    const jan31 = new Date("2026-01-31T00:00:00.000Z");
    // quarterly = +3 months from Jan 31 -> Apr 30 (JS Date normalizes Apr 31 -> May 1,
    // so we assert against the actual UTC month/date arithmetic behavior).
    const expiry = computeExpiryDate("quarterly", jan31);
    expect(expiry.getUTCFullYear()).toBe(2026);
    // Should not silently roll into June; either Apr 30 or May 1 is acceptable
    // depending on native Date overflow handling, but must stay within Apr-May.
    expect([3, 4]).toContain(expiry.getUTCMonth());
  });

  it("does not mutate the input start date", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const startCopy = new Date(start.getTime());
    computeExpiryDate("annual", start);
    expect(start.getTime()).toBe(startCopy.getTime());
  });

  it("throws for an invalid plan type", () => {
    expect(() => computeExpiryDate("monthly" as PlanType, START)).toThrow();
  });
});
