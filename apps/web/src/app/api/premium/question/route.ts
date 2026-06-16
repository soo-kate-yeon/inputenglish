// @MX:ANCHOR: [AUTO] POST /api/premium/question — entitlement-gated highlight question agent with Flash-gate and soft cap.
// @MX:REASON: Fan-in from mobile HighlightBottomSheet; auth + entitlement + monthly cap checked before LLM call.
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-004
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import {
  getMonthlyQuestionCount,
  getCapStatus,
  selectQuestionModel,
} from "@/lib/premium/question-cap";
import { callGeminiWithSchema } from "@/lib/premium/llm-utils";
import { createAdminClient } from "@/utils/supabase/server";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { buildQuestionPrompt } from "@inputenglish/shared";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const questionRequestSchema = z.object({
  highlightText: z.string().min(1),
  question: z.string().min(1),
  context: z.string().optional(),
  sourceType: z.enum(["reading", "segment"]),
  sourceRef: z.object({
    type: z.enum(["reading", "segment"]),
    pieceId: z.string().min(1),
    position: z.number().optional(),
  }),
});

const answerSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: { type: SchemaType.STRING },
  },
  required: ["answer"],
};

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  try {
    const entitlement = await resolvePremiumEntitlement(user);
    if (!entitlement.hasAccess) {
      return NextResponse.json(
        { error: "Premium subscription required", entitlement },
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

    const parseResult = questionRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: parseResult.error.flatten(),
        },
        { status: 400, headers: PREMIUM_API_HEADERS },
      );
    }

    const { highlightText, question, context, sourceType, sourceRef } =
      parseResult.data;

    // Monthly cap check (soft cap - D3: demotion + notice, NOT hard block)
    const supabase = createAdminClient();
    const monthlyCount = await getMonthlyQuestionCount(supabase, user.id);
    const capStatus = getCapStatus(monthlyCount);

    // Flash-gate (D1): model selection based on question complexity and cap status
    const model = selectQuestionModel(question, capStatus.isExceeded);

    const prompt = buildQuestionPrompt({ highlightText, question, context });

    const llmResult = await callGeminiWithSchema(prompt, model, answerSchema);
    if (!llmResult) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503, headers: PREMIUM_API_HEADERS },
      );
    }

    let answer: string;
    try {
      const parsed = JSON.parse(llmResult.text) as { answer?: string };
      answer = parsed.answer ?? llmResult.text;
    } catch {
      answer = llmResult.text;
    }

    // Persist AskedItem to DB
    await supabase.from("asked_items").insert({
      user_id: user.id,
      source_type: sourceType,
      source_ref: sourceRef,
      highlight_text: highlightText,
      question,
      answer,
    });

    const responseBody: {
      answer: string;
      model: string;
      remainingCap: number;
      capNotice?: string;
    } = {
      answer,
      model,
      remainingCap: capStatus.remaining,
    };

    if (capStatus.notice) {
      responseBody.capNotice = capStatus.notice;
    }

    return NextResponse.json(responseBody, { headers: PREMIUM_API_HEADERS });
  } catch (error) {
    console.error("[premium/question] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to answer question",
      },
      { status: 500, headers: PREMIUM_API_HEADERS },
    );
  }
}
