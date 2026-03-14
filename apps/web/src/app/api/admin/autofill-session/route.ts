import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SESSION_ROLE_RELEVANCE,
  SESSION_SOURCE_TYPES,
  SESSION_SPEAKING_FUNCTIONS,
  type Sentence,
  type SessionRoleRelevance,
  type SessionSourceType,
  type SessionSpeakingFunction,
} from "@shadowoo/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface AutofillResponse {
  title: string;
  description: string;
  sourceType?: SessionSourceType;
  speakingFunction?: SessionSpeakingFunction;
  roleRelevance?: SessionRoleRelevance[];
  premiumRequired?: boolean;
}

export async function POST(request: NextRequest) {
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

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Format sentences text
    const sentencesText = sentences.map((s: Sentence) => s.text).join(" ");

    const prompt = `
You are creating a professional English speaking session for Korean learners who want to communicate better at work.

Your output must reflect product goals, not generic language-learning copy.

The session copy should clearly answer:
1. What speaking function or work situation this session trains
2. What the learner will be able to learn or practice
3. What expressions are worth noticing

Tone rules:
- Write in Korean
- Be concise, calm, and practical
- Avoid hype, entertainment-first framing, or exaggerated promises
- Prefer work-relevant outcomes over genre descriptions

Allowed enums:
- sourceType: ${SESSION_SOURCE_TYPES.join(", ")}
- speakingFunction: ${SESSION_SPEAKING_FUNCTIONS.join(", ")}
- roleRelevance: ${SESSION_ROLE_RELEVANCE.join(", ")}

Title rules:
- One line only
- Format close to: "[콘텐츠 출처/형식]로 배우는 [말하기 기능/상황]"
- Emphasize work communication purpose

Description rules:
- Maximum 2 Korean sentences
- Sentence 1: brief work context + what learner will practice
- Sentence 2: which expressions or structures to notice
- Keep it practical and restrained

Transcript excerpt:
"${sentencesText}"

Return ONLY valid JSON:
{
  "title": "string",
  "description": "string",
  "sourceType": "one of allowed enums",
  "speakingFunction": "one of allowed enums",
  "roleRelevance": ["one or more allowed enums"],
  "premiumRequired": true
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.debug("[AdminAutofill] raw AI response:", responseText);

    let autofillData: AutofillResponse;
    try {
      // Clean up potentially wrapped markdown
      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      autofillData = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse AI response:", responseText);
      throw new Error("AI response was not valid JSON");
    }

    // Validate response structure
    if (!autofillData.title || !autofillData.description) {
      throw new Error("Invalid response structure from AI");
    }

    autofillData.sourceType = SESSION_SOURCE_TYPES.includes(
      autofillData.sourceType as SessionSourceType,
    )
      ? (autofillData.sourceType as SessionSourceType)
      : "podcast";

    autofillData.speakingFunction = SESSION_SPEAKING_FUNCTIONS.includes(
      autofillData.speakingFunction as SessionSpeakingFunction,
    )
      ? (autofillData.speakingFunction as SessionSpeakingFunction)
      : "summarize";

    autofillData.roleRelevance = (autofillData.roleRelevance ?? []).filter(
      (role): role is SessionRoleRelevance =>
        SESSION_ROLE_RELEVANCE.includes(role as SessionRoleRelevance),
    );

    if (autofillData.roleRelevance.length === 0) {
      autofillData.roleRelevance = ["pm"];
    }

    autofillData.premiumRequired = Boolean(autofillData.premiumRequired);

    return NextResponse.json(autofillData);
  } catch (error: any) {
    console.error("Session autofill API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to autofill session details" },
      { status: 500 },
    );
  }
}
