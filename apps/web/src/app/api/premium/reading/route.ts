import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import { generateReadingPiece } from "@/lib/premium/reading-generation";
import type { ReadingFormat } from "@inputenglish/shared";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const readingRequestSchema = z.object({
  level: z.string().min(1),
  format: z.enum([
    "noir",
    "economic",
    "business",
    "editorial",
    "dialogue",
    "nonfiction",
  ]),
  topic: z.string().min(1),
  userId: z.string().min(1),
});

// @MX:ANCHOR: [AUTO] POST /api/premium/reading — entitlement-gated reading piece generation.
// @MX:REASON: Fan-in from mobile client; auth + entitlement must be verified before LLM call.
export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  try {
    const entitlement = await resolvePremiumEntitlement(user);
    if (!entitlement.hasAccess) {
      return NextResponse.json(
        { entitlement, piece: null },
        { status: 402, headers: PREMIUM_API_HEADERS },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: PREMIUM_API_HEADERS },
      );
    }

    const parseResult = readingRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: parseResult.error.flatten(),
        },
        { status: 400, headers: PREMIUM_API_HEADERS },
      );
    }

    const { level, format, topic, userId } = parseResult.data;

    const piece = await generateReadingPiece({
      level,
      format: format as ReadingFormat,
      topic,
      userId,
    });

    return NextResponse.json(piece, { headers: PREMIUM_API_HEADERS });
  } catch (error) {
    console.error("[premium/reading] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate reading piece",
      },
      { status: 500, headers: PREMIUM_API_HEADERS },
    );
  }
}
