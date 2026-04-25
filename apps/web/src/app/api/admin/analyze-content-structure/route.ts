import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ContentStructureAnalysisResponse,
  Sentence,
} from "@inputenglish/shared";
import { rewriteCopyToKoreanIfNeeded } from "../utils/korean-copy";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { sentences, videoTitle, primarySpeakerName, shortsOnly } =
      await request.json();

    if (!sentences || !Array.isArray(sentences) || sentences.length < 20) {
      return NextResponse.json(
        { error: "Need at least 20 sentences for hierarchical analysis" },
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

    const transcript = sentences
      .map(
        (sentence: Sentence, idx: number) =>
          `[${idx}] ${sentence.text} (${sentence.startTime.toFixed(1)}s - ${sentence.endTime.toFixed(1)}s)`,
      )
      .join("\n");

    const shortsOnlyPrompt = `
너는 팟캐스트형 영어 학습 앱의 큐레이터야.

목표는 원본 영상에서 독립적으로 학습 가치가 높은 숏폼 2~3개를 고르는 것이야.
롱폼 구간 구분 없이, 영상 전체에서 자유롭게 골라라.

입력 정보:
- 원본 영상 제목: ${videoTitle ? `"${videoTitle}"` : "없음"}
- 대표 화자 이름: ${primarySpeakerName ? `"${String(primarySpeakerName).trim()}"` : "없음"}

short selection rules:
- 영상 전체 구간에서 위치 제한 없이 자유롭게 고를 것
- 30초~120초 정도를 권장
- 재사용 가능한 speaking pattern이나 말하기 payoff가 분명해야 함
- 각 쇼츠는 서로 최대한 다른 payoff를 가져야 함
- 2개 또는 3개를 반환할 것

short difficulty:
- beginner: 짧고 직관적인 구조, 쉬운 어휘
- intermediate: 완충 표현, 복합 문장, 맥락 의존도가 보통
- advanced: 빠른 속도, 직역 어려움, 맥락 의존도가 큼

카피 규칙:
- shorts[].title, shorts[].reason, shorts[].learningPoints, shorts[].patternFocus는 한국어 UX writing으로 쓸 것
- 영어 설명문을 그대로 두지 마라
- 고유명사나 인명은 필요하면 유지해도 된다
- 문장 끝은 가능하면 '~어요/~예요' 톤으로 맞춰라

Transcript:
${transcript}

Return ONLY valid JSON:
{
  "longform": {
    "startIndex": 0,
    "endIndex": ${sentences.length - 1},
    "title": "전체 구간",
    "subtitle": "",
    "description": "",
    "reason": "",
    "speakerSummary": "",
    "conversationType": "",
    "topicTags": [],
    "contentTags": [],
    "estimatedDuration": 0
  },
  "shorts": [
    {
      "startIndex": 0,
      "endIndex": 2,
      "title": "string",
      "reason": "string",
      "learningPoints": ["string", "string"],
      "patternFocus": "string",
      "estimatedDuration": 45,
      "difficulty": "beginner | intermediate | advanced"
    }
  ],
  "totalAnalyzed": ${sentences.length}
}
`;

    const fullAnalysisPrompt = `
너는 팟캐스트형 영어 학습 앱의 큐레이터야.

목표는 원본 영상에서 아래 두 레이어를 함께 고르는 것:
1. longform pack 1개: 15분 이상 20분 이하의 몰입 청취 구간
2. point shorts 3~4개: 위 longform 안에 포함되는 짧은 학습 포인트 구간

핵심 원칙:
- longform은 content-first로 고른다.
- shorts는 pattern-first로 고른다.
- longform은 "누가 무슨 이야기를 어떤 톤으로 하는가"가 중요하다.
- shorts는 "이 표현/구조는 내가 어디서 써먹나"가 중요하다.

입력 정보:
- 원본 영상 제목: ${videoTitle ? `"${videoTitle}"` : "없음"}
- 대표 화자 이름: ${primarySpeakerName ? `"${String(primarySpeakerName).trim()}"` : "없음"}

longform selection rules:
- 반드시 연속 구간이어야 함
- 15분 이상 20분 이하
- 발화의 흐름, 주제 응집도, 몰입 가치가 중요
- 패턴이 많이 나온다고 longform으로 고르지 마라
- 화자/토크/주제 설명이 가능해야 함

short selection rules:
- 반드시 longform 구간 안에서만 고를 것
- 30초~120초 정도를 권장
- 재사용 가능한 speaking pattern이나 말하기 payoff가 분명해야 함
- 각 쇼츠는 서로 최대한 다른 payoff를 가져야 함
- 3개 또는 4개를 반환할 것

short difficulty:
- beginner: 짧고 직관적인 구조, 쉬운 어휘
- intermediate: 완충 표현, 복합 문장, 맥락 의존도가 보통
- advanced: 빠른 속도, 직역 어려움, 맥락 의존도가 큼

카피 규칙:
- longform.title, longform.subtitle, longform.description, longform.reason은 자연스러운 한국어 UX writing으로 쓸 것
- longform.speakerSummary, longform.conversationType도 한국어로 정리할 것
- shorts[].title, shorts[].reason, shorts[].learningPoints, shorts[].patternFocus도 한국어로 쓸 것
- 영어 설명문을 그대로 두지 마라
- 고유명사나 인명은 필요하면 유지해도 된다
- 문장 끝은 가능하면 '~어요/~예요' 톤으로 맞춰라

Transcript:
${transcript}

Return ONLY valid JSON:
{
  "longform": {
    "startIndex": 0,
    "endIndex": 10,
    "title": "string",
    "subtitle": "string",
    "description": "string",
    "reason": "string",
    "speakerSummary": "string",
    "conversationType": "string",
    "topicTags": ["string"],
    "contentTags": ["string"],
    "estimatedDuration": 1200
  },
  "shorts": [
    {
      "startIndex": 0,
      "endIndex": 2,
      "title": "string",
      "reason": "string",
      "learningPoints": ["string", "string"],
      "patternFocus": "string",
      "estimatedDuration": 45,
      "difficulty": "beginner | intermediate | advanced"
    }
  ],
  "totalAnalyzed": ${sentences.length}
}
`;

    const prompt = shortsOnly ? shortsOnlyPrompt : fullAnalysisPrompt;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleaned = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let analysis = JSON.parse(cleaned) as ContentStructureAnalysisResponse;

    if (
      !analysis.longform ||
      !analysis.shorts ||
      !Array.isArray(analysis.shorts)
    ) {
      throw new Error("Invalid AI response structure");
    }

    if (shortsOnly) {
      if (analysis.shorts.length < 2 || analysis.shorts.length > 3) {
        throw new Error("AI must return 2 to 3 shorts in shorts-only mode");
      }
      for (const short of analysis.shorts) {
        if (
          typeof short.startIndex !== "number" ||
          typeof short.endIndex !== "number" ||
          short.startIndex < 0 ||
          short.endIndex >= sentences.length ||
          short.startIndex >= short.endIndex
        ) {
          throw new Error("Invalid short indices");
        }
      }
    } else {
      if (analysis.shorts.length < 3 || analysis.shorts.length > 4) {
        throw new Error("AI must return 3 to 4 shorts");
      }

      if (
        typeof analysis.longform.startIndex !== "number" ||
        typeof analysis.longform.endIndex !== "number" ||
        analysis.longform.startIndex < 0 ||
        analysis.longform.endIndex >= sentences.length ||
        analysis.longform.startIndex >= analysis.longform.endIndex
      ) {
        throw new Error("Invalid longform indices");
      }

      for (const short of analysis.shorts) {
        if (
          typeof short.startIndex !== "number" ||
          typeof short.endIndex !== "number" ||
          short.startIndex < analysis.longform.startIndex ||
          short.endIndex > analysis.longform.endIndex ||
          short.startIndex >= short.endIndex
        ) {
          throw new Error("Short is out of longform range");
        }
      }
    }

    const longformFieldPaths = shortsOnly
      ? []
      : [
          "longform.title",
          "longform.subtitle",
          "longform.description",
          "longform.reason",
          "longform.speakerSummary",
          "longform.conversationType",
          "longform.topicTags",
          "longform.contentTags",
        ];

    analysis = await rewriteCopyToKoreanIfNeeded({
      model,
      payload: analysis,
      fieldPaths: [
        ...longformFieldPaths,
        ...analysis.shorts.flatMap((_, index) => [
          `shorts.${index}.title`,
          `shorts.${index}.reason`,
          `shorts.${index}.learningPoints`,
          `shorts.${index}.patternFocus`,
        ]),
      ],
      instructions:
        "앱 카드나 요약 영역에 바로 노출되는 짧고 자연스러운 한국어로 다시 써라. 설명 문장 끝은 가능하면 `~어요/~예요` 톤으로 맞춰라.",
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analyze content structure API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze content structure" },
      { status: 500 },
    );
  }
}
