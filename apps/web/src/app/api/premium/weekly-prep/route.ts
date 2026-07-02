// @MX:ANCHOR: [AUTO] GET /api/premium/weekly-prep — read-only, RLS-scoped listing of the
//   authenticated user's own latest WeeklyPrep (REQ-WEB-006-U1, AC-006-2).
// @MX:REASON: [AUTO] Web delivery + PDF export happens client-side via window.print()
//   (WeeklyPrepView) — this route only returns the data, scoped strictly to the
//   requesting user's own rows (user_id filter), newest first, single latest row.
// @MX:SPEC: SPEC-WEB-001 Phase 6 Task 6.2 (REQ-WEB-006-U1, AC-006-2)
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import { createAdminClient } from "@/utils/supabase/server";
import type { WeeklyPrep } from "@inputenglish/shared";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function mapWeeklyPrepRow(row: Record<string, unknown>): WeeklyPrep {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    weekStartDate: String(row.week_start_date),
    courseId: (row.course_id as string | null) ?? null,
    vocab: (row.vocab as string[] | null) ?? [],
    expressions: (row.expressions as string[] | null) ?? [],
    sourceSentences:
      (row.source_sentences as WeeklyPrep["sourceSentences"] | null) ?? [],
    sendStatus: row.send_status as WeeklyPrep["sendStatus"],
    createdAt: String(row.created_at),
  };
}

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  try {
    const entitlement = await resolvePremiumEntitlement(user);
    if (!entitlement.hasAccess) {
      return NextResponse.json(
        { entitlement, weeklyPrep: null },
        { status: 402, headers: PREMIUM_API_HEADERS },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("weekly_prep")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const weeklyPrep = rows.length > 0 ? mapWeeklyPrepRow(rows[0]) : null;

    return NextResponse.json({ weeklyPrep }, { headers: PREMIUM_API_HEADERS });
  } catch (error) {
    console.error("[premium/weekly-prep] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch weekly prep",
      },
      { status: 500, headers: PREMIUM_API_HEADERS },
    );
  }
}
