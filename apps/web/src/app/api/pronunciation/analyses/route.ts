import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  processPronunciationAnalysis,
  requestPronunciationAnalysis,
} from "@/lib/pronunciation/service";
import { requireApiUser } from "@/utils/supabase/api-auth";

const pronunciationAnalysisRequestSchema = z.object({
  recordingUrl: z.string().url(),
  referenceText: z.string().min(1),
  sentenceId: z.string().min(1),
  videoId: z.string().min(1),
  sessionId: z.string().uuid().optional().nullable(),
  source: z.enum(["daily-input", "study"]),
  providerLocale: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) {
    return user;
  }

  try {
    const body = await request.json();
    const parsed = pronunciationAnalysisRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pronunciation analysis payload" },
        { status: 400 },
      );
    }

    const job = await requestPronunciationAnalysis({
      userId: user.id,
      sessionId: parsed.data.sessionId ?? null,
      videoId: parsed.data.videoId,
      sentenceId: parsed.data.sentenceId,
      source: parsed.data.source,
      recordingUrl: parsed.data.recordingUrl,
      referenceText: parsed.data.referenceText,
      providerLocale: parsed.data.providerLocale,
    });

    after(async () => {
      try {
        await processPronunciationAnalysis({
          analysisId: job.analysis_id,
          recordingUrl: parsed.data.recordingUrl,
          referenceText: parsed.data.referenceText,
          providerLocale: parsed.data.providerLocale,
        });
      } catch (error) {
        console.error(
          "Pronunciation analysis background processing failed:",
          error,
        );
      }
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error("Pronunciation analysis request failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to request pronunciation analysis",
      },
      { status: 500 },
    );
  }
}
