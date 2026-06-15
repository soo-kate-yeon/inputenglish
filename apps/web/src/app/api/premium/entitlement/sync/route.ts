import { NextRequest, NextResponse } from "next/server";
import {
  RevenueCatConfigurationError,
  syncRevenueCatPlanToUser,
} from "@/lib/premium/revenue-cat-entitlement";
import { requireApiUser } from "@/utils/supabase/api-auth";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  try {
    const result = await syncRevenueCatPlanToUser(user.id);
    return NextResponse.json(
      {
        plan: result.plan,
        activeEntitlementIds: result.activeEntitlementIds,
        source: "revenuecat",
      },
      { headers: PREMIUM_API_HEADERS },
    );
  } catch (error) {
    console.error("[premium/entitlement/sync] failed", error);
    const status = error instanceof RevenueCatConfigurationError ? 503 : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync premium entitlement",
      },
      { status, headers: PREMIUM_API_HEADERS },
    );
  }
}
