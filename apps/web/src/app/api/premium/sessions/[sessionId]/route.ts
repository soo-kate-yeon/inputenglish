import { NextRequest, NextResponse } from "next/server";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import {
  fetchPublishedPremiumSessionById,
  fetchTodayPremiumSessionForUser,
} from "@/lib/premium/repository";
import { requireApiUser } from "@/utils/supabase/api-auth";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
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

    const { sessionId } = await context.params;
    if (entitlement.plan !== "PREMIUM") {
      const todaySession = await fetchTodayPremiumSessionForUser(user.id);
      if (!todaySession || todaySession.id !== sessionId) {
        return NextResponse.json(
          { entitlement, error: "Premium session is not today's curation" },
          { status: 403, headers: PREMIUM_API_HEADERS },
        );
      }
      return NextResponse.json(
        { entitlement, session: todaySession },
        { headers: PREMIUM_API_HEADERS },
      );
    }

    const session = await fetchPublishedPremiumSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { entitlement, error: "Premium session not found" },
        { status: 404, headers: PREMIUM_API_HEADERS },
      );
    }

    return NextResponse.json(
      { entitlement, session },
      { headers: PREMIUM_API_HEADERS },
    );
  } catch (error) {
    console.error("[premium/session] failed", error);
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
