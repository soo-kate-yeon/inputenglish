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

function getRequestRoute(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname ?? new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id")?.trim() ??
    `pron-route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  console.log("[PronunciationAPI] Incoming analysis request:", {
    requestId,
    route: getRequestRoute(request),
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    contentType: request.headers.get("content-type"),
  });

  const user = await requireApiUser(request);
  if (user instanceof Response) {
    return user;
  }

  try {
    const body = await request.json();
    const parsed = pronunciationAnalysisRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.warn("[PronunciationAPI] Invalid analysis payload:", {
        requestId,
        issues: parsed.error.issues,
      });
      return NextResponse.json(
        { error: "Invalid pronunciation analysis payload" },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    console.log("[PronunciationAPI] Authenticated analysis request:", {
      requestId,
      userId: user.id,
      source: parsed.data.source,
      sentenceId: parsed.data.sentenceId,
      sessionId: parsed.data.sessionId ?? null,
      videoId: parsed.data.videoId,
      providerLocale: parsed.data.providerLocale ?? null,
    });

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

    console.log("[PronunciationAPI] Analysis job queued:", {
      requestId,
      userId: user.id,
      analysisId: job.analysis_id,
      status: job.status,
      provider: job.provider,
    });

    return NextResponse.json(job, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    console.error("[PronunciationAPI] Analysis request failed:", {
      requestId,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to request pronunciation analysis",
      },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}
