/**
 * TDD tests for POST /api/billing/issue (Task 2.4, SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Tests the billing-key issuance route that:
 * - Authenticates the user (requireApiUser) -> 401 when missing
 * - Parses { authKey, customerKey }
 * - Calls toss-client.issueBillingKey
 * - Stores billing_key + customer_key + next_renewal_date on the user's active subscription
 *   (service_role UPDATE)
 * - Returns { ok: true } only — no billing_key leak
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockIssueBillingKey } = vi.hoisted(() => ({
  mockIssueBillingKey: vi.fn(),
}));

const { mockFindActiveSubscriptionByUserId, mockUpdateSubscriptionBillingKey } =
  vi.hoisted(() => ({
    mockFindActiveSubscriptionByUserId: vi.fn(),
    mockUpdateSubscriptionBillingKey: vi.fn(),
  }));

const { mockRequireApiUser } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
}));

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: mockRequireApiUser,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({ from: vi.fn() }),
}));

vi.mock("@/lib/billing/toss-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/toss-client")
  >("@/lib/billing/toss-client");
  return {
    ...actual,
    issueBillingKey: mockIssueBillingKey,
  };
});

vi.mock("@/lib/billing/subscription-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/subscription-repository")
  >("@/lib/billing/subscription-repository");
  return {
    ...actual,
    findActiveSubscriptionByUserId: mockFindActiveSubscriptionByUserId,
    updateSubscriptionBillingKey: mockUpdateSubscriptionBillingKey,
  };
});

import { POST } from "@/app/api/billing/issue/route";
import { NextRequest, NextResponse } from "next/server";

const MOCK_USER = { id: "user-issue-0000-000000000001" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/billing/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/issue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue(MOCK_USER);
    mockFindActiveSubscriptionByUserId.mockResolvedValue({
      id: "sub-1",
      user_id: MOCK_USER.id,
      plan_type: "annual",
      status: "active",
    });
    mockUpdateSubscriptionBillingKey.mockResolvedValue(undefined);
    mockIssueBillingKey.mockResolvedValue({
      billingKey: "billing-key-abc",
      customerKey: "ck-abc",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockRequireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const response = await POST(
      makeRequest({ authKey: "ak", customerKey: "ck-abc" }),
    );

    expect(response.status).toBe(401);
    expect(mockIssueBillingKey).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed request body", async () => {
    const response = await POST(makeRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
    expect(mockIssueBillingKey).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no active subscription", async () => {
    mockFindActiveSubscriptionByUserId.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ authKey: "ak", customerKey: "ck-abc" }),
    );

    expect(response.status).toBe(404);
    expect(mockIssueBillingKey).not.toHaveBeenCalled();
  });

  it("calls issueBillingKey with authKey/customerKey and persists the result", async () => {
    const response = await POST(
      makeRequest({ authKey: "ak", customerKey: "ck-abc" }),
    );

    expect(response.status).toBe(200);
    expect(mockIssueBillingKey).toHaveBeenCalledWith({
      authKey: "ak",
      customerKey: "ck-abc",
    });
    expect(mockUpdateSubscriptionBillingKey).toHaveBeenCalledWith(
      expect.anything(),
      "sub-1",
      expect.objectContaining({
        billing_key: "billing-key-abc",
        customer_key: "ck-abc",
      }),
    );
  });

  it("response body is exactly { ok: true } — no billing_key leak", async () => {
    const response = await POST(
      makeRequest({ authKey: "ak", customerKey: "ck-abc" }),
    );

    const payload = await response.json();
    expect(payload).toEqual({ ok: true });
    const json = JSON.stringify(payload);
    expect(json.toLowerCase()).not.toContain("billing_key");
    expect(json.toLowerCase()).not.toContain("billingkey");
  });

  it("returns an error status and performs no DB write when Toss issuance fails", async () => {
    mockIssueBillingKey.mockRejectedValue(new Error("bad auth key"));

    const response = await POST(
      makeRequest({ authKey: "ak", customerKey: "ck-abc" }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mockUpdateSubscriptionBillingKey).not.toHaveBeenCalled();
  });
});
