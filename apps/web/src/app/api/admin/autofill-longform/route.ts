import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Sentence } from "@inputenglish/shared";
import { rewriteCopyToKoreanIfNeeded } from "../utils/korean-copy";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface AutofillLongformResponse {
  title: string;
  subtitle: string;
  description: string;
  speakerSummary: string;
  talkSummary: string;
  topicTags: string[];
  contentTags: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { sentences, videoTitle, primarySpeakerName } =
      (await request.json()) as {
        sentences?: Sentence[];
        videoTitle?: string;
        primarySpeakerName?: string;
      };

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

    const transcript = sentences.map((sentence) => sentence.text).join(" ");
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `
너는 팟캐스트 영어 학습 앱의 롱폼 패키지 소개 문구를 작성한다.

이 작업은 short session copy와 다르다.
- pattern-first 금지
- targetPattern 프레이밍 금지
- content-first로 작성
- 누가, 어떤 종류의 토크에서, 무슨 주제를 길게 풀고 있는지 보여줘야 함

입력:
- 원본 영상 제목: ${videoTitle ? `"${videoTitle}"` : "없음"}
- 대표 화자 이름: ${primarySpeakerName ? `"${primarySpeakerName}"` : "없음"}

Transcript excerpt:
"${transcript}"

작성 규칙:
- 한국어
- 사용자에게 직접 노출되는 문구이므로 title, subtitle, description, speakerSummary, talkSummary는 자연스러운 한국어 UX writing으로 쓸 것
- 고유명사, 인명, 프로그램명처럼 꼭 필요한 경우를 제외하고 영어 문장 그대로 두지 마라
- 딱딱한 번역투 금지. 실제 한국어 서비스 문구처럼 짧고 매끄럽게 쓸 것
- 어미는 가능하면 '~어요/~예요' 톤으로 맞춰라. 설명형 문장도 너무 딱딱하게 끝내지 마라
- 과장 금지
- 영상 소개처럼 쓰되 학습 가치가 느껴져야 함
- title은 콘텐츠가 바로 상상되게 짧게
- subtitle은 한 문장
- description은 2문장 이내
- speakerSummary는 화자의 인상/역할을 짧게
- talkSummary는 어떤 토크인지 한 줄로
- topicTags와 contentTags는 2~5개

금지:
- 영어 설명문 그대로 쓰기
- "이 세션에서는", "학습할 수 있어요", "효과적으로", "전략적으로"
- 지나치게 홍보성인 표현, 과한 감탄

Return ONLY valid JSON:
{
  "title": "string",
  "subtitle": "string",
  "description": "string",
  "speakerSummary": "string",
  "talkSummary": "string",
  "topicTags": ["string"],
  "contentTags": ["string"]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleaned = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let parsed = JSON.parse(cleaned) as AutofillLongformResponse;

    if (!parsed.title || !parsed.description) {
      throw new Error("Invalid longform autofill response");
    }

    parsed = await rewriteCopyToKoreanIfNeeded({
      model,
      payload: parsed,
      fieldPaths: [
        "title",
        "subtitle",
        "description",
        "speakerSummary",
        "talkSummary",
        "topicTags",
        "contentTags",
      ],
      instructions:
        "롱폼 소개 카드에 들어갈 문구처럼 짧고 자연스러운 한국어로 다시 써라. 태그도 가능하면 한국어 명사구로 정리해라. 문장 끝은 가능하면 `~어요/~예요` 톤으로 맞춰라.",
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Longform autofill API error:", error);
    return NextResponse.json(
      { error: "Failed to autofill longform" },
      { status: 500 },
    );
  }
}
