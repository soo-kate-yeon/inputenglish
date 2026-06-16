// @MX:NOTE: [AUTO] DEV-ONLY preview for the highlight question agent — verify real answer quality
//           locally without auth/entitlement/cap/DB. Returns 404 in production.
// @MX:WARN: Bypasses all gating and calls the LLM directly; MUST stay disabled in production.
// @MX:REASON: Unauthenticated LLM access would incur cost and leak prompt internals if exposed in prod.
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-004
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { buildQuestionPrompt } from "@inputenglish/shared";
import { selectQuestionModel } from "@/lib/premium/question-cap";
import { callGeminiWithSchema } from "@/lib/premium/llm-utils";

const DEFAULT_QUESTION = "이게 무슨 뜻이야?";

const answerSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: { answer: { type: SchemaType.STRING } },
  required: ["answer"],
};

const previewSchema = z.object({
  highlightText: z.string().min(1),
  question: z.string().min(1).default(DEFAULT_QUESTION),
  context: z.string().optional(),
  /** Optional model override (e.g. "gemini-2.5-pro") to compare quality across tiers. */
  model: z.string().optional(),
});

type PreviewInput = z.infer<typeof previewSchema>;

function notInDevelopment(): boolean {
  return process.env.NODE_ENV === "production";
}

async function runPreview(input: PreviewInput) {
  const model = input.model ?? selectQuestionModel(input.question, false);
  const prompt = buildQuestionPrompt({
    highlightText: input.highlightText,
    question: input.question,
    context: input.context,
  });

  const llmResult = await callGeminiWithSchema(prompt, model, answerSchema);
  if (!llmResult) {
    return NextResponse.json(
      {
        error: "LLM unavailable — is GEMINI_API_KEY set in .env.local?",
        prompt,
        model,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let answer: string;
  try {
    answer =
      (JSON.parse(llmResult.text) as { answer?: string }).answer ??
      llmResult.text;
  } catch {
    answer = llmResult.text;
  }

  return NextResponse.json(
    { answer, model, context: input.context ?? null, prompt },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (notInDevelopment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing required fields", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return runPreview(parsed.data);
}

export async function GET(request: NextRequest) {
  if (notInDevelopment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = previewSchema.safeParse({
    highlightText: params.get("highlightText") ?? undefined,
    question: params.get("question") ?? undefined,
    context: params.get("context") ?? undefined,
    model: params.get("model") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Missing required query params (highlightText required)",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return runPreview(parsed.data);
}
