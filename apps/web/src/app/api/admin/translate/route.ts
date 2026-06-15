/**
 * POST /api/admin/translate
 *
 * Admin endpoint for translating English sentences to Korean.
 * Delegates to the shared translation lib (apps/web/src/lib/premium/translation.ts).
 * All translation logic (batching, Gemini, fallback) is now in that lib.
 *
 * Kept as a thin HTTP adapter so existing admin UI integrations remain unchanged.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import {
  translateLines,
  createSentenceBatches,
} from "@/lib/premium/translation";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { sentences } = await request.json();

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "Sentences array is required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    // Count batches for metadata (same logic as translation lib)
    const batches = createSentenceBatches(sentences as string[]);
    const translations = await translateLines(sentences as string[]);

    return NextResponse.json({
      translations,
      meta: {
        batchCount: batches.length,
      },
    });
  } catch (error: unknown) {
    console.error("Translation API error:", error);
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "번역 요청이 오래 걸려서 중단됐어요. 범위를 조금만 줄이거나 다시 시도해 주세요."
        : error instanceof Error
          ? error.message
          : "Failed to translate";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
