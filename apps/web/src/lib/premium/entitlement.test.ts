import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
// New in Task 2.6 (SPEC-WEB-001 Phase 2): subscriptions lookup. Defaults to "no
// subscription" so all pre-existing tests above are completely unaffected —
// they never set this and the trial/PREMIUM-fast-path behavior is unchanged.
const subscriptionMaybeSingle = vi.fn().mockResolvedValue({
  data: null,
  error: null,
});

// Routes `.from(table)` to a per-table mock chain so the pre-existing `users`
// query keeps its exact original behavior (single shared `maybeSingle`) while
// the new `subscriptions` query (Task 2.6) is independently controllable.
vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: subscriptionMaybeSingle,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      };
    }),
  })),
}));

const user = {
  id: "user-1",
} as never;
const newAuthUser = {
  id: "user-1",
  created_at: "2026-06-10T00:00:00.000Z",
} as never;
const expiredAuthUser = {
  id: "user-1",
  created_at: "2026-06-01T00:00:00.000Z",
} as never;

describe("resolvePremiumEntitlement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T00:00:00.000Z"));
    maybeSingle.mockReset();
    subscriptionMaybeSingle.mockReset();
    subscriptionMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("allows premium users server-side", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "PREMIUM",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      plan: "PREMIUM",
      reason: "premium",
    });
  });

  it("allows users inside the 7 day trial", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-10T00:00:00.000Z",
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      plan: "FREE",
      reason: "trial",
      trialEndsAt: "2026-06-17T00:00:00.000Z",
    });
  });

  it("allows new auth users inside trial even before a users row exists", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(newAuthUser)).resolves.toMatchObject(
      {
        hasAccess: true,
        plan: "FREE",
        reason: "trial",
        trialEndsAt: "2026-06-17T00:00:00.000Z",
      },
    );
  });

  it("uses auth signup time before users row creation time for trial expiry", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-13T00:00:00.000Z",
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(
      resolvePremiumEntitlement(expiredAuthUser),
    ).resolves.toMatchObject({
      hasAccess: false,
      plan: "FREE",
      reason: "trial-expired",
      trialEndsAt: "2026-06-08T00:00:00.000Z",
    });
  });

  it("blocks free users after the 7 day trial expires", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-01T00:00:00.000Z",
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: false,
      plan: "FREE",
      reason: "trial-expired",
      trialEndsAt: "2026-06-08T00:00:00.000Z",
    });
  });

  // ── Task 2.6 (SPEC-WEB-001 Phase 2): subscription-aware precedence ─────────
  // Precedence: active paid subscription > trial > trial-expired.
  // The `users.plan==='PREMIUM'` fast-path (mobile RevenueCat) must NOT regress.

  it("grants access via an active, non-expired subscription even after trial has expired", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-01T00:00:00.000Z", // trial expired well before "now"
      },
      error: null,
    });
    subscriptionMaybeSingle.mockResolvedValue({
      data: {
        status: "active",
        expiry_date: "2026-12-31T00:00:00.000Z",
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      plan: "FREE",
      reason: "subscription",
      subscriptionExpiresAt: "2026-12-31T00:00:00.000Z",
    });
  });

  it("subscription precedence beats trial-expired even when subscription status is active but trial is also active", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-10T00:00:00.000Z", // trial still active
      },
      error: null,
    });
    subscriptionMaybeSingle.mockResolvedValue({
      data: {
        status: "active",
        expiry_date: "2026-12-31T00:00:00.000Z",
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      reason: "subscription",
      subscriptionExpiresAt: "2026-12-31T00:00:00.000Z",
    });
  });

  it("ignores an active-status subscription whose expiry_date has already passed (falls back to trial precedence)", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-10T00:00:00.000Z", // trial still active
      },
      error: null,
    });
    subscriptionMaybeSingle.mockResolvedValue({
      data: {
        status: "active",
        expiry_date: "2026-01-01T00:00:00.000Z", // already expired
      },
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      reason: "trial",
    });
  });

  it("ignores a cancelled/expired-status subscription row even if expiry_date is in the future", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-01T00:00:00.000Z", // trial expired
      },
      error: null,
    });
    // The repository query itself filters `.eq("status", "active")` server-side, so a
    // cancelled-status row is never returned by a real DB call for this query — the mock
    // simulates that by resolving to null (no row matched the active-status filter),
    // even though the row nominally "exists" with a future expiry_date.
    subscriptionMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: false,
      reason: "trial-expired",
    });
  });

  it("falls back cleanly to trial precedence when no subscription row exists", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-10T00:00:00.000Z",
      },
      error: null,
    });
    subscriptionMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      reason: "trial",
    });
    // Additive field must be present (as null) even when there is no subscription.
    const result = await resolvePremiumEntitlement(user);
    expect(result.subscriptionExpiresAt).toBeNull();
  });

  it("the users.plan==='PREMIUM' fast-path (mobile RevenueCat) is unregressed regardless of subscriptions table state", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "PREMIUM",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });
    // Even with no matching subscriptions row, the PREMIUM fast-path must still win.
    subscriptionMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      plan: "PREMIUM",
      reason: "premium",
    });
  });

  it("does not throw or regress when the subscriptions query itself errors (defensive fallback to trial precedence)", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2026-06-10T00:00:00.000Z",
      },
      error: null,
    });
    subscriptionMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: true,
      reason: "trial",
    });
  });

  it("does not throw or regress when the subscriptions query chain itself throws synchronously (e.g. a test double that only supports one .eq() call — mirrors today-cookie-session.test.ts's tableStub shape)", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        plan: "FREE",
        created_at: "2020-01-01T00:00:00.000Z", // trial expired
      },
      error: null,
    });

    // Simulate a caller whose subscriptions table double only chains a single .eq()
    // (like tableStub in today-cookie-session.test.ts) — the second .eq() call throws
    // synchronously (TypeError: eq is not a function) rather than returning a rejected
    // promise. resolvePremiumEntitlement must swallow this and fall back cleanly.
    const { createAdminClient } = await import("@/utils/supabase/server");
    (
      createAdminClient as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce({
      from: (table: string) => {
        if (table === "subscriptions") {
          return {
            select: () => ({
              eq: () => {
                throw new TypeError("eq is not a function");
              },
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle }) }),
        };
      },
    });

    const { resolvePremiumEntitlement } = await import("./entitlement");
    await expect(resolvePremiumEntitlement(user)).resolves.toMatchObject({
      hasAccess: false,
      reason: "trial-expired",
    });
  });
});
