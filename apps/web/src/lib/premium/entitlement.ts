import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/server";

export interface PremiumEntitlement {
  hasAccess: boolean;
  plan: "FREE" | "PREMIUM";
  reason: "premium" | "trial" | "trial-expired";
  trialEndsAt: string | null;
}

const TRIAL_DAYS = 7;

function parseEntitlementDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

  if (plan === "PREMIUM") {
    return {
      hasAccess: true,
      plan,
      reason: "premium",
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
    };
  }

  return {
    hasAccess: trialActive,
    plan,
    reason: trialActive ? "trial" : "trial-expired",
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
  };
}
