import { NextRequest, NextResponse } from "next/server";
import { getPronunciationAnalysisForUser } from "@/lib/pronunciation/repository";
import { requireApiUser } from "@/utils/supabase/api-auth";

function getRequestRoute(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname ?? new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ analysisId: string }> },
) {
  const requestId =
    request.headers.get("x-request-id")?.trim() ??
    `pron-fetch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.log("[PronunciationAPI] Incoming analysis fetch:", {
    requestId,
    route: getRequestRoute(request),
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
  });

  const user = await requireApiUser(request);
  if (user instanceof Response) {
    return user;
  }

  try {
    const { analysisId } = await context.params;
    console.log("[PronunciationAPI] Authenticated analysis fetch:", {
      requestId,
      userId: user.id,
      analysisId,
    });
    const job = await getPronunciationAnalysisForUser(analysisId, user.id);

    if (!job) {
      return NextResponse.json(
        { error: "Pronunciation analysis not found" },
        { status: 404, headers: { "x-request-id": requestId } },
      );
    }

    return NextResponse.json(job, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    console.error("[PronunciationAPI] Analysis fetch failed:", {
      requestId,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch pronunciation analysis",
      },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}
