import { NextRequest, NextResponse } from "next/server";
import { getPronunciationAnalysisForUser } from "@/lib/pronunciation/repository";
import { requireApiUser } from "@/utils/supabase/api-auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ analysisId: string }> },
) {
  const user = await requireApiUser(request);
  if (user instanceof Response) {
    return user;
  }

  try {
    const { analysisId } = await context.params;
    const job = await getPronunciationAnalysisForUser(analysisId, user.id);

    if (!job) {
      return NextResponse.json(
        { error: "Pronunciation analysis not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Pronunciation analysis fetch failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch pronunciation analysis",
      },
      { status: 500 },
    );
  }
}
