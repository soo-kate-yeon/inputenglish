import { NextRequest, NextResponse } from "next/server";
import {
  buildPremiumPipelineDraft,
  premiumPipelineRequestSchema,
} from "@/lib/premium/pipeline";
import { resolvePremiumKeySegmentForPipeline } from "@/lib/premium/key-segment-ai";
import {
  applyPremiumGeneratedModules,
  resolvePremiumModulesForPipeline,
} from "@/lib/premium/module-ai";
import { resolvePremiumExpressionCardsForPipeline } from "@/lib/premium/expression-card-ai";
import { premiumSessionDraftSchema } from "@/lib/premium/session-schema";
import { loadTranscriptWithYtDlp } from "@/lib/premium/youtube-transcript";
import { requireAdmin } from "@/utils/supabase/admin-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = premiumPipelineRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid premium pipeline payload",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const loaded = parsed.data.transcript?.length
      ? null
      : await loadTranscriptWithYtDlp(parsed.data.sourceUrl);
    const transcript = parsed.data.transcript ?? loaded?.transcript;
    const title = parsed.data.title ?? loaded?.metadata.title;
    const keySegmentResolution =
      parsed.data.keySegments || !transcript?.length
        ? null
        : await resolvePremiumKeySegmentForPipeline({
            sourceUrl: parsed.data.sourceUrl,
            title,
            transcript,
          });

    const result = buildPremiumPipelineDraft({
      ...parsed.data,
      transcript,
      title,
      keySegments:
        parsed.data.keySegments ??
        (keySegmentResolution ? [keySegmentResolution.keySegment] : undefined),
      channelName:
        parsed.data.channelName ??
        loaded?.metadata.channel ??
        loaded?.metadata.uploader,
      thumbnailUrl: parsed.data.thumbnailUrl ?? loaded?.metadata.thumbnail,
      durationSeconds:
        parsed.data.durationSeconds ??
        (loaded?.metadata.duration
          ? Math.ceil(loaded.metadata.duration)
          : undefined),
    });
    const expressionResolution = await resolvePremiumExpressionCardsForPipeline(
      result.session,
    );
    const sessionWithExpressionCards = premiumSessionDraftSchema.parse({
      ...result.session,
      expression_cards: expressionResolution.cards,
    });
    const moduleResolution = await resolvePremiumModulesForPipeline(
      sessionWithExpressionCards,
    );
    const session = moduleResolution.modules
      ? applyPremiumGeneratedModules(
          sessionWithExpressionCards,
          moduleResolution.modules,
        )
      : sessionWithExpressionCards;

    return NextResponse.json({
      ...result,
      session,
      pipeline: {
        ...result.pipeline,
        keySegmentSource: parsed.data.keySegments
          ? "operator"
          : (keySegmentResolution?.source ?? "fallback"),
        keySegmentProvider: keySegmentResolution?.provider ?? null,
        keySegmentModel: keySegmentResolution?.model ?? null,
        moduleSource: moduleResolution.source,
        moduleProvider: moduleResolution.provider,
        moduleModel: moduleResolution.model,
        expressionCardSource: expressionResolution.source,
        expressionCardProvider: expressionResolution.provider,
        expressionCardModel: expressionResolution.model,
      },
    });
  } catch (error) {
    console.error("[admin/premium/pipeline/draft] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create premium pipeline draft",
      },
      { status: 422 },
    );
  }
}
