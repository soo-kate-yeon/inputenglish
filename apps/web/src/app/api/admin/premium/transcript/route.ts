import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadTranscriptWithYtDlp } from "@/lib/premium/youtube-transcript";
import { requireAdmin } from "@/utils/supabase/admin-auth";

const premiumTranscriptRequestSchema = z.object({
  sourceUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = premiumTranscriptRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid premium transcript payload",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const loaded = await loadTranscriptWithYtDlp(parsed.data.sourceUrl);

    return NextResponse.json({
      transcript: loaded.transcript,
      metadata: {
        title: loaded.metadata.title ?? null,
        duration: loaded.metadata.duration ?? null,
        channel: loaded.metadata.channel ?? loaded.metadata.uploader ?? null,
        thumbnail: loaded.metadata.thumbnail ?? null,
      },
    });
  } catch (error) {
    console.error("[admin/premium/transcript] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load premium transcript",
      },
      { status: 422 },
    );
  }
}
