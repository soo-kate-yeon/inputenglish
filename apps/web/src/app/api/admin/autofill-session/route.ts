import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Sentence } from "@shadowoo/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Format sentences text
    const sentencesText = sentences.map((s: Sentence) => s.text).join(" ");

    const prompt = `
You are an English learning content creator. Generate a title and description for a shadowing learning session based on the transcript excerpt.

**Title Format (STRICT):**
"[영상컨텐츠의 제목 혹은 큰 카테고리]로 배우는 [커뮤니케이션의 목적, 상황]"

**Title Requirements:**
- Keep it simple and concise
- First part: Video source, content type, or category (영화, 팟캐스트, 브이로그, TED Talk 등)
- Second part: Communication purpose or situation (what the learner will be able to do)
- Write in Korean

**Title Examples (FOLLOW THIS EXACT STYLE):**
✅ "OpenAI 팟캐스트로 배우는 회사에서 의견 공유하는 법"
✅ "악마는 프라다를 입는다로 배우는 동료와의 캐주얼 토크"
✅ "브이로그로 배우는 미국 대학생의 찐친 수다"
✅ "내가 세련됐다고 생각하는 20가지: 내 취향 영어로 설명하는 법"
✅ "미드 Friends로 배우는 친구에게 부탁하는 법"
✅ "인터뷰 클립으로 배우는 자기소개 하는 법"

**Description (STRICT 2 LINES LIMIT):**
- EXACTLY 2 lines only
- Line 1: Brief context + what learner will practice
- Line 2: Highlight specific expressions from the transcript with "~표현에 주목해보세요." ending
- Use friendly Korean "~요" ending

**Description Examples:**
✅ "악마는 프라다를 입는다 클립으로 직장 동료와의 자연스러운 커뮤니케이션을 배워봐요. \"That's all\", \"I don't think so\" 같은 표현에 주목해보세요."
✅ "팟캐스트에서 진행자가 의견을 나누는 방식을 따라해 봐요. \"I think~\", \"In my opinion~\" 표현에 주목해보세요."
✅ "유튜버의 일상 브이로그로 친구처럼 편하게 대화하는 법을 배워봐요. \"You know what?\", \"So basically~\" 표현에 주목해보세요."

Transcript excerpt:
"${sentencesText}"

Return ONLY valid JSON (no markdown):
{
  "title": "[영상컨텐츠]로 배우는 [커뮤니케이션 목적/상황]",
  "description": "첫 줄: 상황 설명과 학습 목표. 두 번째 줄: \"표현1\", \"표현2\" 표현에 주목해보세요."
}

CRITICAL: Keep title simple. Description must be EXACTLY 2 lines.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let autofillData: { title: string; description: string };
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

    return NextResponse.json(autofillData);
  } catch (error: any) {
    console.error("Session autofill API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to autofill session details" },
      { status: 500 },
    );
  }
}
