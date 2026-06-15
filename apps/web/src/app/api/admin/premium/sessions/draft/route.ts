import { NextRequest, NextResponse } from "next/server";
import {
  buildPremiumArticleRow,
  buildPremiumExpressionRows,
  buildPremiumSessionRow,
  premiumSessionDraftSchema,
} from "@/lib/premium/session-schema";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = premiumSessionDraftSchema.safeParse(body.session ?? body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid premium session draft", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: savedSession, error: sessionError } = await supabase
      .from("premium_sessions")
      .upsert(buildPremiumSessionRow(parsed.data, auth.id))
      .select("id")
      .single();

    if (sessionError) throw sessionError;

    const sessionId = String(savedSession.id);
    const { error: articleError } = await supabase
      .from("premium_articles")
      .upsert(buildPremiumArticleRow(sessionId, parsed.data.article), {
        onConflict: "session_id",
      });

    if (articleError) throw articleError;

    const { error: deleteCardsError } = await supabase
      .from("premium_expression_cards")
      .delete()
      .eq("session_id", sessionId);

    if (deleteCardsError) throw deleteCardsError;

    const expressionRows = buildPremiumExpressionRows(
      sessionId,
      parsed.data.expression_cards,
    );

    if (expressionRows.length > 0) {
      const { error: cardsError } = await supabase
        .from("premium_expression_cards")
        .insert(expressionRows);

      if (cardsError) throw cardsError;
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: "draft",
      articleSaved: true,
      expressionCount: expressionRows.length,
    });
  } catch (error) {
    console.error("[admin/premium/draft] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save premium draft",
      },
      { status: 500 },
    );
  }
}
