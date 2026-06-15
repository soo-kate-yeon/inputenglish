import { NextRequest, NextResponse } from "next/server";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import { fetchTodayPremiumSessionForUser } from "@/lib/premium/repository";
import { requireApiUser } from "@/utils/supabase/api-auth";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  try {
    const entitlement = await resolvePremiumEntitlement(user);
    if (!entitlement.hasAccess) {
      return NextResponse.json(
        { entitlement, session: null },
        { status: 402, headers: PREMIUM_API_HEADERS },
      );
    }

    const session = await fetchTodayPremiumSessionForUser(user.id);
    return NextResponse.json(
      { entitlement, session },
      { headers: PREMIUM_API_HEADERS },
    );
  } catch (error) {
    console.error("[premium/today] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch premium session",
      },
      { status: 500, headers: PREMIUM_API_HEADERS },
    );
  }
}
