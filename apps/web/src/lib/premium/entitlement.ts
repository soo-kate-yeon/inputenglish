import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/server";

export interface PremiumEntitlement {
  hasAccess: boolean;
  plan: "FREE" | "PREMIUM";
  reason: "premium" | "subscription" | "trial" | "trial-expired";
  trialEndsAt: string | null;
  /**
   * Additive field (SPEC-WEB-001 Phase 2, Task 2.6): expiry_date of the active paid
   * subscription that granted access, when `reason === "subscription"`. Always present
   * (null when not applicable) so existing consumers destructuring this object are
   * unaffected by the new field.
   */
  subscriptionExpiresAt: string | null;
}

const TRIAL_DAYS = 7;

function parseEntitlementDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Looks up the user's active, non-expired paid subscription (Task 2.6). Returns null on
 * "no subscription" AND on any query error/exception — a subscriptions lookup failure must
 * NEVER throw or block the pre-existing trial/PREMIUM entitlement path (defensive fallback,
 * required so this addition stays byte-identical-safe for every existing caller of
 * resolvePremiumEntitlement that does not model a subscriptions table in its test doubles).
 */
async function findActiveNonExpiredSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ expiryDate: Date } | null> {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, expiry_date")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      // Fail toward "no subscription" (the secure default), but log so an infra
      // problem (RLS misconfig, outage) is observable instead of silently
      // presenting as a paying user losing access.
      console.error(
        `[entitlement] subscriptions lookup failed for user ${userId}: ${error.message}`,
      );
      return null;
    }
    if (!data) return null;

    const expiryDate = parseEntitlementDate(
      (data as { expiry_date?: unknown }).expiry_date,
    );
    if (!expiryDate || expiryDate.getTime() <= Date.now()) return null;

    return { expiryDate };
  } catch (err) {
    console.error(
      `[entitlement] subscriptions lookup threw for user ${userId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function resolvePremiumEntitlement(
  user: User,
): Promise<PremiumEntitlement> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("plan, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  const plan = data?.plan === "PREMIUM" ? "PREMIUM" : "FREE";
  const createdAt =
    parseEntitlementDate(user.created_at) ??
    parseEntitlementDate(data?.created_at);
  const trialEndsAt = createdAt
    ? new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const trialActive = Boolean(
    trialEndsAt && trialEndsAt.getTime() > Date.now(),
  );

  // Precedence: active paid subscription > trial > trial-expired.
  // The users.plan==='PREMIUM' fast-path (mobile RevenueCat) always wins first and is
  // completely unaffected by the subscriptions table (checked/returned before this lookup).
  if (plan === "PREMIUM") {
    return {
      hasAccess: true,
      plan,
      reason: "premium",
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      subscriptionExpiresAt: null,
    };
  }

  const activeSubscription = await findActiveNonExpiredSubscription(
    supabase,
    user.id,
  );
  if (activeSubscription) {
    return {
      hasAccess: true,
      plan,
      reason: "subscription",
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      subscriptionExpiresAt: activeSubscription.expiryDate.toISOString(),
    };
  }

  return {
    hasAccess: trialActive,
    plan,
    reason: trialActive ? "trial" : "trial-expired",
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    subscriptionExpiresAt: null,
  };
}
