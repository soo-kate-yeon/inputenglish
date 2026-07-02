// @MX:ANCHOR: [AUTO] GET /api/premium/asked-items — read-only question history listing.
// @MX:REASON: [AUTO] Task 5.6 (REQ-WEB-004-U3, EC-004-C): reuses the existing AskedItem
//   table/type as-is (SPEC-INPUT-001) — this route only lists the authenticated user's
//   own rows, newest first. EC-004-C: this surface (and the learning screen) must NOT
//   expose flashcards, recall quizzes, or an "expression dictionary" curation UI — only
//   the raw question-history list itself.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.6 (REQ-WEB-004-U3, EC-004-C)
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import { createAdminClient } from "@/utils/supabase/server";
import type { AskedItem } from "@inputenglish/shared";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function mapAskedItemRow(row: Record<string, unknown>): AskedItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sourceType: row.source_type as AskedItem["sourceType"],
    sourceRef: row.source_ref as AskedItem["sourceRef"],
    highlightText: String(row.highlight_text),
    question: (row.question as string | null) ?? null,
    answer: (row.answer as string | null) ?? null,
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
        { entitlement, items: [] },
        { status: 402, headers: PREMIUM_API_HEADERS },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("asked_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const items = (data ?? []).map((row) =>
      mapAskedItemRow(row as Record<string, unknown>),
    );

    return NextResponse.json({ items }, { headers: PREMIUM_API_HEADERS });
  } catch (error) {
    console.error("[premium/asked-items] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch question history",
      },
      { status: 500, headers: PREMIUM_API_HEADERS },
    );
  }
}
