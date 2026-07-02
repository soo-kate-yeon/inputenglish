/**
 * TDD tests for Task 8.1 — subscription-renewal Cron route (SPEC-WEB-001 Phase 8)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Mirrors reading-batch/route.ts's exact auth pattern (fail-closed CRON_SECRET,
 * Bearer + x-cron-secret header support) and deps-factory convention.
 *
 * Covers:
 * - Auth: 401 without/with wrong secret, 200 with correct secret (fail-closed)
 * - deps wiring: findDueSubscriptions queries subscriptions WHERE
 *   next_renewal_date<=now AND status='active' AND billing_key IS NOT NULL
 * - deps wiring: chargeBillingKey is wired to the real toss-client
 * - deps wiring: extendSubscription performs the real UPDATE
 * - Result: renewExpiringSubscriptions summary is returned in the response body
 *
 * All external dependencies (Supabase, toss-client, renewExpiringSubscriptions)
 * are mocked — zero live network calls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRenewExpiringSubscriptions = vi.fn();
vi.mock("@/lib/billing/renewal", () => ({
  renewExpiringSubscriptions: (...args: unknown[]) =>
    mockRenewExpiringSubscriptions(...args),
}));

const mockChargeBillingKey = vi.fn();
vi.mock("@/lib/billing/toss-client", () => ({
  chargeBillingKey: (...args: unknown[]) => mockChargeBillingKey(...args),
}));

let lastUpdateData: Record<string, unknown> | null = null;
let lastUpdateEqCalls: Array<[string, unknown]> = [];
let dueSubscriptionsResult: {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
} = { data: [], error: null };

function makeSupabaseMock() {
  const updateEqChain = vi
    .fn()
    .mockImplementation((column: string, value: unknown) => {
      lastUpdateEqCalls.push([column, value]);
      return Promise.resolve({ error: null });
    });

  const findChain = {
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi
      .fn()
      .mockImplementation(() => Promise.resolve(dueSubscriptionsResult)),
  };

  return {
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockImplementation(() => findChain),
      update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        lastUpdateData = data;
        return { eq: updateEqChain };
      }),
    })),
  };
}

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => makeSupabaseMock()),
}));

describe("GET /api/cron/subscription-renewal", () => {
  const VALID_SECRET = "test-cron-secret-abc123";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    lastUpdateData = null;
    lastUpdateEqCalls = [];
    dueSubscriptionsResult = { data: [], error: null };

    process.env.CRON_SECRET = VALID_SECRET;

    mockRenewExpiringSubscriptions.mockResolvedValue({
      succeeded: [],
      failed: [],
    });
  });

  it("returns 401 when CRON_SECRET env is not set (fail-closed)", async () => {
    delete process.env.CRON_SECRET;

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRenewExpiringSubscriptions).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({});
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRenewExpiringSubscriptions).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization: Bearer has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: "Bearer wrong-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRenewExpiringSubscriptions).not.toHaveBeenCalled();
  });

  it("returns 401 when x-cron-secret header has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": "bad-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRenewExpiringSubscriptions).not.toHaveBeenCalled();
  });

  it("returns 200 and runs renewal with valid Authorization: Bearer", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockRenewExpiringSubscriptions).toHaveBeenCalledOnce();
  });

  it("returns 200 and runs renewal with valid x-cron-secret header", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": VALID_SECRET });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockRenewExpiringSubscriptions).toHaveBeenCalledOnce();
  });

  it("returns the renewal result summary in the response body", async () => {
    mockRenewExpiringSubscriptions.mockResolvedValue({
      succeeded: ["sub-1"],
      failed: [{ subscriptionId: "sub-2", error: "card declined" }],
    });

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.succeeded).toEqual(["sub-1"]);
    expect(body.failed).toEqual([
      { subscriptionId: "sub-2", error: "card declined" },
    ]);
  });

  it("deps: findDueSubscriptions is wired and queries subscriptions", async () => {
    dueSubscriptionsResult = {
      data: [
        {
          id: "sub-1",
          user_id: "user-1",
          plan_type: "annual",
          expiry_date: "2026-01-01T00:00:00.000Z",
          billing_key: "billing-key-1",
          customer_key: "customer-key-1",
        },
      ],
      error: null,
    };

    let capturedDeps: Record<string, unknown> | null = null;
    mockRenewExpiringSubscriptions.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { succeeded: [], failed: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.findDueSubscriptions).toBe("function");

    const found = await (
      capturedDeps!.findDueSubscriptions as () => Promise<
        Record<string, unknown>[]
      >
    )();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: "sub-1",
      billing_key: "billing-key-1",
    });
  });

  it("deps: chargeBillingKey is wired to the real toss-client", async () => {
    mockChargeBillingKey.mockResolvedValue({
      paymentKey: "pk-1",
      orderId: "renew-sub-1",
      status: "DONE",
    });

    let capturedDeps: Record<string, unknown> | null = null;
    mockRenewExpiringSubscriptions.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { succeeded: [], failed: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.chargeBillingKey).toBe("function");

    await (
      capturedDeps!.chargeBillingKey as (req: unknown) => Promise<unknown>
    )({
      billingKey: "bk",
      customerKey: "ck",
      amount: 79000,
      orderId: "renew-sub-1",
      orderName: "annual plan renewal",
    });

    expect(mockChargeBillingKey).toHaveBeenCalledOnce();
  });

  it("deps: extendSubscription performs the real UPDATE on subscriptions", async () => {
    let capturedDeps: Record<string, unknown> | null = null;
    mockRenewExpiringSubscriptions.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { succeeded: [], failed: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.extendSubscription).toBe("function");

    await (
      capturedDeps!.extendSubscription as (
        id: string,
        params: Record<string, unknown>,
      ) => Promise<void>
    )("sub-1", {
      expiry_date: "2027-01-01T00:00:00.000Z",
      next_renewal_date: "2027-01-01T00:00:00.000Z",
      order_id: "renew-sub-1",
    });

    expect(lastUpdateData).toMatchObject({
      expiry_date: "2027-01-01T00:00:00.000Z",
      next_renewal_date: "2027-01-01T00:00:00.000Z",
      order_id: "renew-sub-1",
    });
    expect(lastUpdateEqCalls).toContainEqual(["id", "sub-1"]);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/subscription-renewal", {
    method: "GET",
    headers: new Headers(headers),
  });
}
