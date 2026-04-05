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

대상: 영어로 일하는 한국인. 꼭 회의실 상황이 아니어도 됨.
목적: "이 표현, 나도 언젠가 쓸 것 같은데" 싶은 장면을 고를 것.

씬 선택 기준 (우선순위 순):
1. 명확한 말하기 목적 — 아래 중 하나에 해당:
   설득, 지표 설명, 핵심 요약, 완화 표현, 반대 의견, 제안, 질문 답변,
   생각할 시간 벌기, 확인/되묻기, 실수 수습, 관계 형성/스몰토크, 주제 전환
2. 실생활 재사용성 — 회의·발표뿐 아니라 점심 대화, 화상회의 앞뒤 스몰토크,
   출장 중 대화, 처음 만난 사람과의 잡담도 가치 있는 씬으로 인정
3. 독립 세션 가능성 — 시작-전개-마무리가 있어서 하나의 학습 단위로 성립
4. 자연스러운 톤 — "프로페셔널해 보이는 톤"이 아니라 "실제 원어민이 이 상황에서 말하는 톤"
5. 길이: 30-120초

3개 씬 구성 가이드:
- 최소 1개는 formal한 상황 (발표, 실적 공유, 제안 등)
- 최소 1개는 semi-formal/casual 상황 (스몰토크, Q&A 후 대화, 1:1 잡담 등)
  단, 이 씬에서도 배울 수 있는 표현 구조가 있어야 함
- 나머지 1개는 자유롭게 판단

이런 씬은 피할 것:
- 내용 없이 필러만 반복되는 장면
- 문맥 없이 단발 감탄사만 있는 장면
- 영어 원어민도 구조가 없다고 느낄 만한 장면

난이도 판단 기준:
- beginner: 짧은 문장, 느린 속도, 일상적 어휘, 한국어 직역에 가까운 구조
- intermediate: 복합 문장, 보통 속도, hedging/수사적 표현 포함
- advanced: 빠른 속도, 연음 많음, 문화적 맥락 이해 필요, 직역하면 뜻이 달라지는 표현

한국어 작성 톤:
- 구어체 OK (~거든요, ~인데요, ~해요)
- "효과적인", "전략적으로", "활용하여" 금지
- "~를 학습합니다", "~할 수 있습니다" 금지
- "비즈니스 영어", "업무 영어", "커뮤니케이션 스킬" 금지

씬 제목 가이드:
- 학습자가 "이거 필요한데" 싶어서 탭하고 싶은 제목
- 좋은 예: "숫자 꺼내기 전에 맥락부터 까는 법", "모르는 사람한테 말 걸 때 자연스러운 오프닝"
- 나쁜 예: "효과적인 데이터 기반 커뮤니케이션", "전략적 비즈니스 발표 기법"

learningPoints 가이드:
- 구체적이고 실용적으로. 추상적 문법 용어만 나열하지 말 것.
- 좋은 예: "숫자 말하기 전에 'We're seeing' 관찰형으로 시작하는 패턴",
           "처음 만난 사람한테 'So tell me about...'으로 자연스럽게 말 꺼내기"
- 나쁜 예: "효과적인 수사법 활용", "데이터 커뮤니케이션 역량 강화"

reason 가이드:
- 왜 이 씬이 학습할 가치가 있는지. 말하기 목적 + 상황 + 학습자 페이오프.
- 좋은 예: "숫자를 나열하는 대신 의미를 먼저 전달하는 구조를 연습할 수 있어요"
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
      "estimatedDuration": 45,
      "difficulty": "beginner | intermediate | advanced"
    }
  ],
  "totalAnalyzed": ${sentences.length}
}

Requirements:
- Return exactly 3 scenes
- Scenes should not overlap
- startIndex and endIndex are array indices (0-based)
- estimatedDuration should be calculated from timestamps (endTime - startTime)
- Include difficulty for each scene based on the criteria above
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
