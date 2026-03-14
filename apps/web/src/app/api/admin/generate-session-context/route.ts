import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SESSION_SPEAKING_FUNCTIONS,
  type Sentence,
  type SessionContext,
  type SessionSpeakingFunction,
} from "@shadowoo/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface GenerateContextRequest {
  title: string;
  description?: string;
  speakingFunction?: SessionSpeakingFunction;
  sentences: Sentence[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateContextRequest;
    const { title, description, speakingFunction, sentences } = body;

    if (!title || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "title and sentences are required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const transcript = sentences.map((sentence) => sentence.text).join(" ");
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `
You are generating a pre-learning context brief for a professional English speaking practice app.

Write in Korean for Korean learners.
The goal is to help the learner understand why this clip matters in real work communication.

Keep the tone practical, restrained, and productized.
Do not be motivational or overly academic.

Allowed speaking functions:
${SESSION_SPEAKING_FUNCTIONS.join(", ")}

Session title:
${title}

Session description:
${description ?? ""}

Current speaking function hint:
${speakingFunction ?? ""}

Transcript excerpt:
${transcript}

Return ONLY valid JSON:
{
  "strategic_intent": "why the speaker uses this wording here",
  "speaking_function": "one allowed enum",
  "reusable_scenarios": ["2-3 short Korean scenarios"],
  "key_vocabulary": ["3-5 words or short phrases"],
  "grammar_rhetoric_note": "one practical note about structure, tone, hedge, contrast, emphasis, etc.",
  "expected_takeaway": "one sentence describing what the learner should be able to do after this session"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.debug("[SessionContext] raw AI response:", responseText);
    const cleanedText = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText) as SessionContext;

    if (!parsed.strategic_intent || !parsed.expected_takeaway) {
      throw new Error("Invalid context response structure");
    }

    const normalizedFunction = SESSION_SPEAKING_FUNCTIONS.includes(
      parsed.speaking_function as SessionSpeakingFunction,
    )
      ? (parsed.speaking_function as SessionSpeakingFunction)
      : (speakingFunction ?? "summarize");

    const reusableScenarios = Array.isArray(parsed.reusable_scenarios)
      ? parsed.reusable_scenarios
          .map((scenario) => scenario?.trim())
          .filter(Boolean)
      : [];

    const keyVocabulary = Array.isArray(parsed.key_vocabulary)
      ? parsed.key_vocabulary.map((item) => item?.trim()).filter(Boolean)
      : [];

    return NextResponse.json({
      strategic_intent: parsed.strategic_intent.trim(),
      speaking_function: normalizedFunction,
      reusable_scenarios: reusableScenarios,
      key_vocabulary: keyVocabulary,
      grammar_rhetoric_note: parsed.grammar_rhetoric_note?.trim() ?? "",
      expected_takeaway: parsed.expected_takeaway.trim(),
      generated_by: "gemini",
    } satisfies SessionContext);
  } catch (error: any) {
    console.error("Session context generation API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate session context" },
      { status: 500 },
    );
  }
}
