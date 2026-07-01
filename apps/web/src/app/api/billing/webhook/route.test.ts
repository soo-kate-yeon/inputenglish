/**
 * TDD tests for POST /api/billing/webhook (Task 2.5, SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Tests the webhook receiver that:
 * - Verifies the raw-body signature against TOSS_WEBHOOK_SECRET BEFORE any parsing/mutation
 * - Invalid signature -> 401 with ZERO state change (subscription/user rows untouched)
 * - Idempotent by orderId (reuses the order_id uniqueness from Task 2.2b — see NOTE below)
 * - On a verified event, syncs subscriptions.status and users.plan to match
 *
 * NOTE on idempotency choice: this route reuses subscriptions.order_id (already unique,
 * Task 2.2b) rather than introducing a separate webhook event-id column. Toss always
 * includes the original orderId in status-change webhooks, and every webhook we care about
 * (CANCELED / EXPIRED / DONE) maps 1:1 to an existing subscription row found by that orderId.
 * A duplicate webhook delivery for the same orderId + status is a no-op (status already
 * matches) rather than a second write.
 *
 * Mocking pattern: mirrors confirm/route.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyWebhookSignature } = vi.hoisted(() => ({
  mockVerifyWebhookSignature: vi.fn(),
}));

const { mockFindSubscriptionByOrderId, mockUpdateSubscriptionStatus } =
  vi.hoisted(() => ({
    mockFindSubscriptionByOrderId: vi.fn(),
    mockUpdateSubscriptionStatus: vi.fn(),
  }));

const { mockUsersUpdate, mockUsersEq } = vi.hoisted(() => ({
  mockUsersUpdate: vi.fn(),
  mockUsersEq: vi.fn(),
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

vi.mock("@/lib/billing/webhook-verify", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
}));

vi.mock("@/lib/billing/subscription-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/subscription-repository")
  >("@/lib/billing/subscription-repository");
  return {
    ...actual,
    findSubscriptionByOrderId: mockFindSubscriptionByOrderId,
    updateSubscriptionStatus: mockUpdateSubscriptionStatus,
  };
});

import { POST } from "@/app/api/billing/webhook/route";
import { NextRequest } from "next/server";

function makeRequest(rawBody: string, signature: string | null): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature !== null) headers["toss-signature"] = signature;

  return new NextRequest("http://localhost/api/billing/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function makeSubscriptionRow(overrides?: Record<string, unknown>) {
  return {
    id: "sub-1",
    user_id: "user-1",
    plan_type: "annual",
    start_date: "2026-07-01T00:00:00.000Z",
    expiry_date: "2027-07-01T00:00:00.000Z",
    status: "active",
    billing_key: "super-secret-billing-key",
    customer_key: "customer-key-abc",
    next_renewal_date: "2027-06-24T00:00:00.000Z",
    order_id: "order-123",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockFindSubscriptionByOrderId.mockResolvedValue(makeSubscriptionRow());
    mockUpdateSubscriptionStatus.mockResolvedValue(undefined);
    mockUsersEq.mockResolvedValue({ error: null });
    mockUsersUpdate.mockReturnValue({ eq: mockUsersEq });
  });

  it("returns 401 with zero state change when the signature is invalid", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "CANCELED" },
    });

    const response = await POST(makeRequest(rawBody, "bad-signature"));

    expect(response.status).toBe(401);
    expect(mockFindSubscriptionByOrderId).not.toHaveBeenCalled();
    expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 with zero state change when the signature header is missing", async () => {
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "CANCELED" },
    });
    mockVerifyWebhookSignature.mockReturnValue(false);

    const response = await POST(makeRequest(rawBody, null));

    expect(response.status).toBe(401);
    expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("verifies the signature against the exact raw body (called before any parsing)", async () => {
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "CANCELED" },
    });

    await POST(makeRequest(rawBody, "good-signature"));

    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      rawBody,
      "good-signature",
    );
  });

  it("returns 400 when the verified payload is malformed", async () => {
    const rawBody = JSON.stringify({ foo: "bar" });

    const response = await POST(makeRequest(rawBody, "good-signature"));

    expect(response.status).toBe(400);
    expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
  });

  it("returns 404 when no subscription matches the webhook's orderId", async () => {
    mockFindSubscriptionByOrderId.mockResolvedValue(null);
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "unknown-order", status: "CANCELED" },
    });

    const response = await POST(makeRequest(rawBody, "good-signature"));

    expect(response.status).toBe(404);
    expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
  });

  it("on a verified CANCELED event: syncs subscriptions.status and users.plan to FREE", async () => {
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "CANCELED" },
    });

    const response = await POST(makeRequest(rawBody, "good-signature"));

    expect(response.status).toBe(200);
    expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith(
      expect.anything(),
      "sub-1",
      "cancelled",
    );
    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "FREE" }),
    );
    expect(mockUsersEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("on a verified DONE event: syncs subscriptions.status to active and users.plan to PREMIUM", async () => {
    mockFindSubscriptionByOrderId.mockResolvedValue(
      makeSubscriptionRow({ status: "expired" }),
    );
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "DONE" },
    });

    const response = await POST(makeRequest(rawBody, "good-signature"));

    expect(response.status).toBe(200);
    expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith(
      expect.anything(),
      "sub-1",
      "active",
    );
    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "PREMIUM" }),
    );
  });

  it("is a no-op status sync (still 200) when the webhook status already matches — idempotent redelivery", async () => {
    mockFindSubscriptionByOrderId.mockResolvedValue(
      makeSubscriptionRow({ status: "cancelled" }),
    );
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "CANCELED" },
    });

    const response = await POST(makeRequest(rawBody, "good-signature"));

    expect(response.status).toBe(200);
    // Already cancelled — redelivery should not perform a redundant DB write.
    expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    expect(mockUsersUpdate).not.toHaveBeenCalled();
  });

  it("never includes billing_key/customer_key in the response body", async () => {
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: { orderId: "order-123", status: "CANCELED" },
    });

    const response = await POST(makeRequest(rawBody, "good-signature"));
    const payload = await response.json();
    const json = JSON.stringify(payload);
    expect(json.toLowerCase()).not.toContain("billing_key");
    expect(json).not.toContain("super-secret-billing-key");
  });
});
