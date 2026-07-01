/**
 * TDD tests for Task 2.7 — Auto-renewal logic function (SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers:
 * - renewExpiringSubscriptions(deps): queries subscriptions where next_renewal_date <= now,
 *   status='active', billing_key present.
 * - For each: calls toss-client.chargeBillingKey; on success extends expiry_date/
 *   next_renewal_date by the plan's duration (reuses Task 2.1's duration logic).
 * - On charge failure: leaves the subscription's expiry/renewal dates untouched, records
 *   the failure in the result for the caller (Phase 8 Cron / notification hook).
 * - NO cron route/wiring here — only the tested function.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renewExpiringSubscriptions } from "./renewal";

function makeDueSubscription(overrides?: Record<string, unknown>) {
  return {
    id: "sub-1",
    user_id: "user-1",
    plan_type: "annual" as const,
    start_date: "2025-07-01T00:00:00.000Z",
    expiry_date: "2026-07-01T00:00:00.000Z",
    status: "active" as const,
    billing_key: "billing-key-abc",
    customer_key: "customer-key-abc",
    next_renewal_date: "2026-06-24T00:00:00.000Z",
    order_id: "order-original",
    created_at: "2025-07-01T00:00:00.000Z",
    updated_at: "2025-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("renewExpiringSubscriptions", () => {
  let chargeBillingKey: ReturnType<typeof vi.fn>;
  let findDueSubscriptions: ReturnType<typeof vi.fn>;
  let extendSubscription: ReturnType<typeof vi.fn>;
  let onPreNoticeHook: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T00:00:00.000Z"));

    chargeBillingKey = vi.fn().mockResolvedValue({
      paymentKey: "pk-renew-1",
      orderId: "renew-sub-1-1",
      status: "DONE",
    });
    findDueSubscriptions = vi.fn().mockResolvedValue([makeDueSubscription()]);
    extendSubscription = vi.fn().mockResolvedValue(undefined);
    onPreNoticeHook = vi.fn().mockResolvedValue(undefined);
  });

  it("queries for subscriptions due for renewal via the injected findDueSubscriptions dep", async () => {
    await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(findDueSubscriptions).toHaveBeenCalledTimes(1);
  });

  it("calls chargeBillingKey for each due subscription with its billing_key/customer_key/amount/orderId", async () => {
    await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(chargeBillingKey).toHaveBeenCalledTimes(1);
    const [request] = chargeBillingKey.mock.calls[0];
    expect(request).toMatchObject({
      billingKey: "billing-key-abc",
      customerKey: "customer-key-abc",
      amount: 79000, // annual plan price (Task 2.1)
    });
    expect(typeof request.orderId).toBe("string");
    expect(request.orderId).not.toBe("order-original"); // must be a fresh, unique orderId
  });

  it("on charge success: extends expiry_date and next_renewal_date by the plan's duration", async () => {
    await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(extendSubscription).toHaveBeenCalledTimes(1);
    const [subscriptionId, params] = extendSubscription.mock.calls[0];
    expect(subscriptionId).toBe("sub-1");
    // annual plan: old expiry 2026-07-01 + 12 months -> 2027-07-01
    expect(params.expiry_date).toBe("2027-07-01T00:00:00.000Z");
    expect(params.next_renewal_date).toBe("2027-07-01T00:00:00.000Z");
    expect(params.order_id).toBe(chargeBillingKey.mock.calls[0][0].orderId);
  });

  it("on charge failure: does not call extendSubscription and records the failure in the result", async () => {
    chargeBillingKey.mockRejectedValue(
      new Error("EXCEED_MAX_DAILY_PAYMENT_COUNT"),
    );

    const result = await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(extendSubscription).not.toHaveBeenCalled();
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      subscriptionId: "sub-1",
      error: expect.stringContaining("EXCEED_MAX_DAILY_PAYMENT_COUNT"),
    });
  });

  it("processes multiple due subscriptions independently — one failure does not block others", async () => {
    const subA = makeDueSubscription({
      id: "sub-a",
      plan_type: "quarterly",
      billing_key: "billing-key-a",
    });
    const subB = makeDueSubscription({
      id: "sub-b",
      plan_type: "semiannual",
      billing_key: "billing-key-b",
    });
    findDueSubscriptions.mockResolvedValue([subA, subB]);
    chargeBillingKey.mockImplementation((request: { billingKey: string }) => {
      if (request.billingKey === subA.billing_key) {
        return Promise.reject(new Error("card declined"));
      }
      return Promise.resolve({
        paymentKey: "pk",
        orderId: "renew-x",
        status: "DONE",
      });
    });

    const result = await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(result.succeeded).toEqual(["sub-b"]);
    expect(result.failed.map((f) => f.subscriptionId)).toEqual(["sub-a"]);
    expect(extendSubscription).toHaveBeenCalledTimes(1);
  });

  it("returns a result summary with succeeded/failed subscription id lists", async () => {
    const result = await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(result).toMatchObject({
      succeeded: ["sub-1"],
      failed: [],
    });
  });

  it("invokes the optional onChargeFailure hook (documented interface for Phase 7 pre-notice) without sending anything itself", async () => {
    chargeBillingKey.mockRejectedValue(new Error("card declined"));

    await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
      onChargeFailure: onPreNoticeHook,
    });

    expect(onPreNoticeHook).toHaveBeenCalledTimes(1);
    expect(onPreNoticeHook).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: "sub-1",
        userId: "user-1",
        error: expect.stringContaining("card declined"),
      }),
    );
  });

  it("does not call chargeBillingKey at all when there are no due subscriptions", async () => {
    findDueSubscriptions.mockResolvedValue([]);

    const result = await renewExpiringSubscriptions({
      chargeBillingKey,
      findDueSubscriptions,
      extendSubscription,
    });

    expect(chargeBillingKey).not.toHaveBeenCalled();
    expect(result).toEqual({ succeeded: [], failed: [] });
  });
});
