import { NextRequest, NextResponse } from "next/server";
import type { PremiumExpressionCard } from "@inputenglish/shared";
import {
  getPremiumPublishIssues,
  mapPremiumArticleRow,
  premiumExpressionCardBaseSchema,
  premiumSessionDraftSchema,
} from "@/lib/premium/session-schema";
import { sendPremiumDailyCurationPush } from "@/lib/premium/push-notifications";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const publishedOn =
      typeof body.publishedOn === "string" && body.publishedOn.trim()
        ? body.publishedOn.trim()
        : new Date().toISOString().slice(0, 10);

    const supabase = createAdminClient();
    const { data: sessionRow, error: sessionError } = await supabase
      .from("premium_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!sessionRow) {
      return NextResponse.json(
        { error: "Premium session not found" },
        { status: 404 },
      );
    }

    const { data: cardRows, error: cardsError } = await supabase
      .from("premium_expression_cards")
      .select("*")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    if (cardsError) throw cardsError;

    const { data: articleRow, error: articleError } = await supabase
      .from("premium_articles")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (articleError) throw articleError;

    const cards = (cardRows ?? []).map((row) =>
      premiumExpressionCardBaseSchema.parse({
        id: row.id,
        session_id: row.session_id,
        source_sentence_id: row.source_sentence_id,
        order_index: row.order_index,
        depth: row.depth,
        expression: row.expression,
        source_line: row.source_line,
        timestamp: row.timestamp,
        natural_meaning_ko: row.natural_meaning_ko,
        story: row.story,
        pronunciation: row.pronunciation,
        variations: row.variations,
        saved_atoms: row.saved_atoms,
        reviewed: row.reviewed,
      }),
    ) as PremiumExpressionCard[];

    const parsedSession = premiumSessionDraftSchema.parse({
      id: sessionRow.id,
      slug: sessionRow.slug,
      source_video_id: sessionRow.source_video_id,
      source_url: sessionRow.source_url,
      title: sessionRow.title,
      subtitle: sessionRow.subtitle,
      description: sessionRow.description,
      thumbnail_url: sessionRow.thumbnail_url,
      channel_name: sessionRow.channel_name,
      speaker_name: sessionRow.speaker_name,
      duration_seconds: sessionRow.duration_seconds,
      segment_start_time: Number(sessionRow.segment_start_time ?? 0),
      segment_end_time: Number(sessionRow.segment_end_time ?? 0),
      transcript: sessionRow.transcript,
      article: articleRow
        ? mapPremiumArticleRow(articleRow)
        : sessionRow.article,
      delivery_analysis: sessionRow.delivery_analysis,
      roleplay: sessionRow.roleplay,
      // Stored cards are checked below so publish violations return 422 issues.
      expression_cards: [],
      reviewed: sessionRow.reviewed,
      published_on: publishedOn,
    });

    const issues = getPremiumPublishIssues({
      session: parsedSession,
      cards,
    });
    if (issues.length > 0) {
      return NextResponse.json(
        { error: "Premium session is not publishable", issues },
        { status: 422 },
      );
    }

    const { error: updateError } = await supabase
      .from("premium_sessions")
      .update({
        status: "published",
        published_on: publishedOn,
        published_at: new Date().toISOString(),
        updated_by: auth.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    const today = new Date().toISOString().slice(0, 10);
    let pushNotification: { sent: number; skipped?: string } = {
      sent: 0,
      skipped: "future-publish-date",
    };
    if (publishedOn <= today) {
      try {
        const pushResult = await sendPremiumDailyCurationPush({
          id: sessionId,
          title: parsedSession.title,
          description: parsedSession.description ?? null,
        });
        pushNotification = { sent: pushResult.sent };
      } catch (pushError) {
        console.warn(
          "[admin/premium/publish] push notification failed",
          pushError,
        );
        pushNotification = { sent: 0, skipped: "send-failed" };
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: "published",
      publishedOn,
      pushNotification,
    });
  } catch (error) {
    console.error("[admin/premium/publish] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish premium session",
      },
      { status: 500 },
    );
  }
}
