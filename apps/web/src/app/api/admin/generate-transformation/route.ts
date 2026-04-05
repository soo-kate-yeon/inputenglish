// @MX:NOTE: [AUTO] Gemini-powered transformation exercise generation (SPEC-MOBILE-011).
// Analyzes session sentences to produce 4 exercises (2x kr-to-en, 1 qa-response, 1 dialog-completion).
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Sentence } from "@inputenglish/shared";

interface GenerateTransformationRequest {
  sessionId: string;
  sentences: Sentence[];
  speakingFunction?: string;
}

interface GeneratedExercise {
  page_order: number;
  exercise_type: string;
  instruction_text: string;
  source_korean?: string;
  question_text?: string;
  dialog_lines?: Array<{ speaker: string; text: string; is_blank: boolean }>;
}

interface GenerateTransformationResponse {
  set: {
    target_pattern: string;
    pattern_type: string;
  };
  exercises: GeneratedExercise[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateTransformationRequest;
    const { sessionId, sentences } = body;

    if (!sessionId || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "sessionId and sentences are required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const transcript = sentences.map((s) => s.text).join(" ");

    const prompt = `
You are an English learning exercise designer. Analyze the following English transcript and create transformation practice exercises.

Transcript:
"${transcript}"

Generate exactly 4 exercises that help learners practice using the most common grammatical pattern found in the transcript.

Requirements:
- Identify the most reusable declarative pattern from the transcript
- Generate 2 kr-to-en exercises (page_order 2 and 4) with DIFFERENT Korean sentences
- Generate 1 qa-response exercise (page_order 3)
- Generate 1 dialog-completion exercise (page_order 5) with 2-3 lines, exactly one blank turn (is_blank: true)
- All English content (questions, dialog) must be natural business English
- Korean sentences should be business-appropriate and clearly different from each other

Return ONLY valid JSON in this exact format:
{
  "set": {
    "target_pattern": "short description of the grammatical pattern",
    "pattern_type": "declarative" or "interrogative"
  },
  "exercises": [
    {
      "page_order": 2,
      "exercise_type": "kr-to-en",
      "instruction_text": "Translate the following sentence into English.",
      "source_korean": "Korean sentence 1"
    },
    {
      "page_order": 3,
      "exercise_type": "qa-response",
      "instruction_text": "Answer the question in English.",
      "question_text": "Business question in English"
    },
    {
      "page_order": 4,
      "exercise_type": "kr-to-en",
      "instruction_text": "Translate the following sentence into English.",
      "source_korean": "Korean sentence 2 (DIFFERENT from sentence 1)"
    },
    {
      "page_order": 5,
      "exercise_type": "dialog-completion",
      "instruction_text": "Complete the dialog by filling in the blank.",
      "dialog_lines": [
        {"speaker": "Manager", "text": "Non-blank line in English", "is_blank": false},
        {"speaker": "You", "text": "The blank line the user will say", "is_blank": true}
      ]
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as GenerateTransformationResponse;

    // Validate structure
    if (!parsed.set || !Array.isArray(parsed.exercises)) {
      return NextResponse.json(
        { error: "Invalid AI response structure" },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[generate-transformation] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
