import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Sentence, SceneAnalysisResponse } from "@inputenglish/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

    // Need at least 5 sentences to make meaningful scene recommendations
    if (sentences.length < 5) {
      return NextResponse.json(
        { error: "Need at least 5 sentences for scene analysis" },
        { status: 400 },
      );
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Format sentences with indices for easy reference
    const sentencesText = sentences
      .map(
        (s: Sentence, idx: number) =>
          `[${idx}] ${s.text} (${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s)`,
      )
      .join("\n");

    const prompt = `
트랜스크립트에서 학습 세션으로 만들 만한 씬 3개를 골라줘.

대상: 영어로 일하는 3-7년차 한국 직장인.
목적: "이 클립 따라 하면 내 회의/발표에서 바로 써먹겠다" 싶은 장면만 고를 것.

씬 선택 기준 (우선순위 순):
1. 명확한 말하기 목적 — 지표 설명, 업데이트 공유, 방향 제안, 질문 답변, 설득, 요약, 반대, 완화 중 하나에 해당
2. 업무 재사용성 — 데모, 스탠드업, 실적 공유, 로드맵 리뷰, 인터뷰, Q&A 등에서 실제로 쓸 수 있는 표현
3. 독립 세션 가능성 — 시작-전개-마무리가 있어서 하나의 학습 단위로 성립
4. 프로페셔널 톤 — 잡담, 필러 위주, 감탄사 남발이 아닌 절제된 비즈니스 톤
5. 길이: 30-120초

이런 씬은 피할 것:
- 일반적인 인사/잡담
- 구조 없이 분위기만 좋은 장면
- 단어는 어려운데 실무에서 쓸 일 없는 장면

한국어 작성 톤:
- 구어체 OK (~거든요, ~인데요, ~해요)
- "효과적인", "전략적으로", "활용하여" 금지
- "~를 학습합니다", "~할 수 있습니다" 금지

씬 제목 가이드:
- 학습자가 "이거 필요한데" 싶어서 탭하고 싶은 제목
- 좋은 예: "숫자 꺼내기 전에 맥락부터 까는 법", "요약 잘하는 사람은 첫 문장이 다르다"
- 나쁜 예: "효과적인 데이터 기반 커뮤니케이션", "전략적 비즈니스 발표 기법"

learningPoints 가이드:
- 구체적이고 실용적으로. 추상적 문법 용어만 나열하지 말 것.
- 좋은 예: "숫자 변화를 말할 때 'We're seeing' 관찰형으로 시작하는 패턴", "질문에 바로 답하지 않고 맥락을 먼저 주는 답변 구조"
- 나쁜 예: "효과적인 수사법 활용", "데이터 커뮤니케이션 역량 강화"

reason 가이드:
- 왜 이 씬이 학습할 가치가 있는지. 말하기 목적 + 업무 상황 + 학습자 페이오프.
- 좋은 예: "실적 공유에서 숫자를 나열하는 대신 의미를 먼저 전달하는 구조를 연습할 수 있어요"
- 나쁜 예: "비즈니스 환경에서 효과적으로 커뮤니케이션하는 방법을 학습할 수 있습니다"

Transcript:
${sentencesText}

Return ONLY a valid JSON object (no markdown formatting) with this exact structure:
{
  "scenes": [
    {
      "startIndex": 0,
      "endIndex": 3,
      "title": "씬 제목 (한국어)",
      "reason": "이 씬이 왜 연습할 가치가 있는지 (한국어)",
      "learningPoints": ["학습 포인트 1", "학습 포인트 2", "학습 포인트 3"],
      "estimatedDuration": 45
    }
  ],
  "totalAnalyzed": ${sentences.length}
}

Requirements:
- Return exactly 3 scenes
- Scenes should not overlap
- startIndex and endIndex are array indices (0-based)
- estimatedDuration should be calculated from timestamps (endTime - startTime)
- At least 2 of the 3 scenes should clearly map to a concrete business speaking scenario
- All scenes combined should maximize product value, not just transcript coverage
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let analysisResult: SceneAnalysisResponse;
    try {
      // Clean up potentially wrapped markdown
      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      analysisResult = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse AI response:", responseText);
      throw new Error("AI response was not valid JSON");
    }

    // Validate response structure
    if (!analysisResult.scenes || !Array.isArray(analysisResult.scenes)) {
      throw new Error("Invalid response structure from AI");
    }

    if (analysisResult.scenes.length !== 3) {
      throw new Error("AI did not return exactly 3 scenes");
    }

    // Validate each scene
    for (const scene of analysisResult.scenes) {
      if (
        typeof scene.startIndex !== "number" ||
        typeof scene.endIndex !== "number" ||
        !scene.title ||
        !scene.reason ||
        !Array.isArray(scene.learningPoints)
      ) {
        throw new Error("Invalid scene structure");
      }

      // Validate indices are within bounds
      if (
        scene.startIndex < 0 ||
        scene.endIndex >= sentences.length ||
        scene.startIndex > scene.endIndex
      ) {
        throw new Error(
          `Invalid scene indices: ${scene.startIndex}-${scene.endIndex}`,
        );
      }
    }

    return NextResponse.json(analysisResult);
  } catch (error: any) {
    console.error("Scene analysis API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze scenes" },
      { status: 500 },
    );
  }
}
