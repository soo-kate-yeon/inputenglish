import { NextRequest, NextResponse } from "next/server";
import {
  generatePremiumExpressionCard,
  hasPremiumExpressionModelConfig,
  premiumExpressionCardRequestSchema,
} from "@/lib/premium/expression-card-ai";
import { requireAdmin } from "@/utils/supabase/admin-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    if (!hasPremiumExpressionModelConfig()) {
      return NextResponse.json(
        { error: "Premium expression model is not configured" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const parsed = premiumExpressionCardRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid expression prompt payload",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await generatePremiumExpressionCard(parsed.data);

    return NextResponse.json({
      card: result.card,
      meta: result.meta,
    });
  } catch (error) {
    console.error("[admin/premium/expression-card] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate expression card",
      },
      { status: 502 },
    );
  }
}
