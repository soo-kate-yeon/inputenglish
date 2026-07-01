// @MX:ANCHOR: [AUTO] Single source of truth for Toss subscription pricing + duration.
// @MX:REASON: [AUTO] Server-side price re-derivation is the anti-tamper boundary for
//   /api/billing/confirm (Task 2.3): the client-submitted amount is always checked
//   against PLAN_PRICES_KRW here, never trusted as-is. (SPEC-WEB-001 Phase 2, Task 2.1)
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.1

/** The three subscription plan types supported by Toss billing (matches subscriptions.plan_type CHECK). */
export type PlanType = "annual" | "semiannual" | "quarterly";

/** PRD v1.4 KRW prices, keyed by plan type. */
export const PLAN_PRICES_KRW: Record<PlanType, number> = {
  annual: 79000,
  semiannual: 49000,
  quarterly: 29000,
};

const VALID_PLAN_TYPES: ReadonlySet<string> = new Set([
  "annual",
  "semiannual",
  "quarterly",
]);

/** Type guard for narrowing an unknown value to PlanType. */
export function isValidPlanType(value: unknown): value is PlanType {
  return typeof value === "string" && VALID_PLAN_TYPES.has(value);
}

const PLAN_DURATION_MONTHS: Record<PlanType, number> = {
  annual: 12,
  semiannual: 6,
  quarterly: 3,
};

/**
 * Computes the subscription expiry date for a given plan type, starting from `startDate`.
 * Does not mutate `startDate`. Throws for unrecognized plan types.
 */
export function computeExpiryDate(planType: PlanType, startDate: Date): Date {
  if (!isValidPlanType(planType)) {
    throw new Error(`computeExpiryDate: invalid plan type "${planType}"`);
  }

  const months = PLAN_DURATION_MONTHS[planType];
  const expiry = new Date(startDate.getTime());
  expiry.setUTCMonth(expiry.getUTCMonth() + months);
  return expiry;
}
