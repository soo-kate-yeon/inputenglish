/**
 * TDD tests for POST /api/billing/confirm (Task 2.3, SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Tests the payment confirmation route that:
 * - Authenticates the user (requireApiUser) -> 401 when missing
 * - Parses { paymentKey, orderId, amount, planType }
 * - Re-derives expected amount from PLAN_PRICES_KRW; rejects mismatch (400, zero writes)
 * - Idempotency: returns existing subscription unchanged when order_id already exists
 * - On success: calls toss-client.confirmPayment, inserts subscriptions row (with order_id),
 *   updates users.plan = 'PREMIUM' (dual-write, subscriptions insert first)
 * - On Toss failure: no mutation, error status returned
 * - Response never includes billing_key/customer_key
 *
 * Mocking pattern: mirrors vocab-signal/route.test.ts (vi.hoisted for cross-mock references).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockConfirmPayment } = vi.hoisted(() => ({
  mockConfirmPayment: vi.fn(),
}));

const { mockFindSubscriptionByOrderId, mockInsertSubscription } = vi.hoisted(
  () => ({
    mockFindSubscriptionByOrderId: vi.fn(),
    mockInsertSubscription: vi.fn(),
  }),
);

const { mockRequireApiUser } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
}));

const { mockUsersUpdate, mockUsersEq } = vi.hoisted(() => ({
  mockUsersUpdate: vi.fn(),
  mockUsersEq: vi.fn(),
}));

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: mockRequireApiUser,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "users") {
        return { update: mockUsersUpdate };
      }
      throw new Error(`unexpected table access in test: ${table}`);
    },
  }),
}));

vi.mock("@/lib/billing/toss-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/toss-client")
  >("@/lib/billing/toss-client");
  return {
    ...actual,
    confirmPayment: mockConfirmPayment,
  };
});

vi.mock("@/lib/billing/subscription-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/subscription-repository")
  >("@/lib/billing/subscription-repository");
  return {
    ...actual,
    findSubscriptionByOrderId: mockFindSubscriptionByOrderId,
    insertSubscription: mockInsertSubscription,
  };
});

import { POST } from "@/app/api/billing/confirm/route";
import { NextRequest, NextResponse } from "next/server";

const MOCK_USER = { id: "user-confirm-0000-000000000001" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/billing/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

function makeSubscriptionRow(overrides?: Record<string, unknown>) {
  return {
    id: "sub-1",
    user_id: MOCK_USER.id,
    plan_type: "annual",
    start_date: "2026-07-01T00:00:00.000Z",
    expiry_date: "2027-07-01T00:00:00.000Z",
    status: "active",
    billing_key: "super-secret-billing-key",
    customer_key: "customer-key-abc",
    next_renewal_date: null,
    order_id: "order-123",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("POST /api/billing/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue(MOCK_USER);
    mockUsersEq.mockResolvedValue({ error: null });
    mockUsersUpdate.mockReturnValue({ eq: mockUsersEq });
    mockFindSubscriptionByOrderId.mockResolvedValue(null);
    mockInsertSubscription.mockResolvedValue(makeSubscriptionRow());
    mockConfirmPayment.mockResolvedValue({
      paymentKey: "pk",
      orderId: "order-123",
      status: "DONE",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockRequireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 79000,
        planType: "annual",
      }),
    );

    expect(response.status).toBe(401);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockInsertSubscription).not.toHaveBeenCalled();
  });

  it("rejects with 400 and performs zero writes when amount does not match the plan price", async () => {
    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 1, // tampered — real annual price is 79000
        planType: "annual",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockInsertSubscription).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("rejects with 400 for an invalid planType", async () => {
    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 79000,
        planType: "monthly",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  it("is idempotent: returns the existing subscription unchanged when order_id already exists", async () => {
    const existing = makeSubscriptionRow();
    mockFindSubscriptionByOrderId.mockResolvedValue(existing);

    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 79000,
        planType: "annual",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockInsertSubscription).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload.subscription).not.toHaveProperty("billing_key");
    expect(payload.subscription).not.toHaveProperty("customer_key");
  });

  it("on Toss success: inserts subscription (with order_id) then updates users.plan=PREMIUM", async () => {
    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 79000,
        planType: "annual",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockConfirmPayment).toHaveBeenCalledWith({
      paymentKey: "pk",
      orderId: "order-123",
      amount: 79000,
    });
    expect(mockInsertSubscription).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        user_id: MOCK_USER.id,
        plan_type: "annual",
        order_id: "order-123",
      }),
    );
    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "PREMIUM" }),
    );
    expect(mockUsersEq).toHaveBeenCalledWith("id", MOCK_USER.id);

    // dual-write order: subscriptions insert BEFORE users update
    const insertOrder = mockInsertSubscription.mock.invocationCallOrder[0];
    const updateOrder = mockUsersUpdate.mock.invocationCallOrder[0];
    expect(insertOrder).toBeLessThan(updateOrder);
  });

  it("never returns billing_key/customer_key in the success response", async () => {
    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 79000,
        planType: "annual",
      }),
    );

    const payload = await response.json();
    const json = JSON.stringify(payload);
    expect(json.toLowerCase()).not.toContain("billing_key");
    expect(json.toLowerCase()).not.toContain("billingkey");
    expect(json).not.toContain("super-secret-billing-key");
    expect(json).not.toContain("customer-key-abc");
  });

  it("on Toss failure: performs no mutation and returns an error status", async () => {
    mockConfirmPayment.mockRejectedValue(new Error("Card declined"));

    const response = await POST(
      makeRequest({
        paymentKey: "pk",
        orderId: "order-123",
        amount: 79000,
        planType: "annual",
      }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mockInsertSubscription).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed request body", async () => {
    const response = await POST(makeRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });
});
