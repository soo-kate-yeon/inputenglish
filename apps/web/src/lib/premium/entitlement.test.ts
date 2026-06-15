import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle,
        })),
      })),
    })),
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
});
