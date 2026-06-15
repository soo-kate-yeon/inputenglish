import { createAdminClient } from "@/utils/supabase/server";

export type RevenueCatVerifiedPlan = "FREE" | "PREMIUM";

export interface RevenueCatPlanSyncResult {
  plan: RevenueCatVerifiedPlan;
  activeEntitlementIds: string[];
}

interface RevenueCatEntitlement {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
  };
}

export class RevenueCatConfigurationError extends Error {
  constructor() {
    super("REVENUECAT_SECRET_API_KEY is not configured");
    this.name = "RevenueCatConfigurationError";
  }
}

function getRevenueCatApiBaseUrl() {
  return (
    process.env.REVENUECAT_API_BASE_URL?.replace(/\/$/, "") ??
    "https://api.revenuecat.com/v1"
  );
}

function getRevenueCatSecretApiKey() {
  const key = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!key) throw new RevenueCatConfigurationError();
  return key;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEntitlementActive(
  entitlement: RevenueCatEntitlement,
  now = new Date(),
) {
  const graceEndsAt = parseDate(entitlement.grace_period_expires_date);
  if (graceEndsAt && graceEndsAt.getTime() > now.getTime()) return true;

  const expiresAt = parseDate(entitlement.expires_date);
  return !expiresAt || expiresAt.getTime() > now.getTime();
}

export function derivePlanFromRevenueCatSubscriber(
  payload: RevenueCatSubscriberResponse,
  now = new Date(),
): RevenueCatPlanSyncResult {
  const entitlements = payload.subscriber?.entitlements ?? {};
  const activeEntitlementIds = Object.entries(entitlements)
    .filter(([, entitlement]) => isEntitlementActive(entitlement, now))
    .map(([id]) => id);

  return {
    plan: activeEntitlementIds.length > 0 ? "PREMIUM" : "FREE",
    activeEntitlementIds,
  };
}

export async function fetchRevenueCatPlanForUser(
  userId: string,
): Promise<RevenueCatPlanSyncResult> {
  const response = await fetch(
    `${getRevenueCatApiBaseUrl()}/subscribers/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getRevenueCatSecretApiKey()}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `RevenueCat subscriber lookup failed (${response.status})${body ? `: ${body}` : ""}`,
    );
  }

  const payload = (await response.json()) as RevenueCatSubscriberResponse;
  return derivePlanFromRevenueCatSubscriber(payload);
}

export async function syncRevenueCatPlanToUser(
  userId: string,
): Promise<RevenueCatPlanSyncResult> {
  const result = await fetchRevenueCatPlanForUser(userId);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ plan: result.plan })
    .eq("id", userId);

  if (error) throw error;
  return result;
}
