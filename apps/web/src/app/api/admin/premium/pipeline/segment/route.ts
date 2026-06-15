import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  calculatePremiumCrop,
  premiumPipelineRequestSchema,
} from "@/lib/premium/pipeline";
import { resolvePremiumKeySegmentForPipeline } from "@/lib/premium/key-segment-ai";
import { premiumTranscriptLineSchema } from "@/lib/premium/session-schema";
import { requireAdmin } from "@/utils/supabase/admin-auth";

const premiumSegmentRequestSchema = premiumPipelineRequestSchema
  .pick({
    sourceUrl: true,
    title: true,
    durationSeconds: true,
  })
  .extend({
    transcript: z.array(premiumTranscriptLineSchema).min(1),
  });

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = premiumSegmentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid premium segment payload",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const resolution = await resolvePremiumKeySegmentForPipeline({
      sourceUrl: parsed.data.sourceUrl,
      title: parsed.data.title,
      transcript: parsed.data.transcript,
    });
    const transcriptEnd = Math.ceil(
      Math.max(...parsed.data.transcript.map((line) => line.endTime)),
    );
    const crop = calculatePremiumCrop(
      resolution.keySegment,
      parsed.data.durationSeconds ?? transcriptEnd,
    );

    return NextResponse.json({
      keySegment: resolution.keySegment,
      crop,
      source: resolution.source,
      provider: resolution.provider,
      model: resolution.model,
    });
  } catch (error) {
    console.error("[admin/premium/pipeline/segment] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to select premium segment",
      },
      { status: 422 },
    );
  }
}
