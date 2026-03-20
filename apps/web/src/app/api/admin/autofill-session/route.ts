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
} from "@inputenglish/shared";

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
You are writing session copy for a professional English speaking app for Korean office workers.

Your reader is a 3-7년차 한국 직장인 who can communicate in English but wants to sound more professional and natural.
Write like a senior colleague giving a quick tip — not like a textbook or a marketing brochure.

Voice & tone:
- 한국어로 작성. 구어체 허용 (~거든요, ~인데요, ~해요, ~이에요)
- 짧고 직접적. 한 문장에 하나의 정보만.
- 실제 업무 상황과 연결. "이 표현을 회의에서 쓸 수 있다"가 핵심.
- 담백하고 건조하게. 감탄사, 과장, 동기부여 금지.

금지 표현 (이런 단어가 나오면 다시 써라):
- "효과적인", "전략적으로", "핵심 역량", "활용하여"
- "~를 학습합니다", "~할 수 있습니다", "~를 익혀보세요"
- "이 세션에서는", "함께 살펴보겠습니다", "실력을 키워보세요"
- "커뮤니케이션 스킬", "비즈니스 영어", "글로벌 역량"

Allowed enums:
- sourceType: ${SESSION_SOURCE_TYPES.join(", ")}
- speakingFunction: ${SESSION_SPEAKING_FUNCTIONS.join(", ")}
- roleRelevance: ${SESSION_ROLE_RELEVANCE.join(", ")}

Title rules:
- 한 줄. 15자 내외.
- 학습자가 "이거 나한테 필요한데" 싶은 느낌이어야 함.
- 아래 패턴 중 자유롭게 선택 (하나에 고정하지 말 것):
  a) 행동 중심: "숫자 꺼내기 전에 '왜'부터 까는 법"
  b) 상황 중심: "반대할 때 'But'으로 시작하지 않기"
  c) 패턴 중심: "3분 안에 프로젝트 근황 정리하는 패턴"
  d) 표현 중심: "'We're seeing' 하나로 단정 피하기"
  e) 자유형: "요약 잘하는 사람은 첫 문장이 다르다"

Description rules:
- 최대 2문장 한국어.
- 문장 1: 왜 이걸 연습해야 하는지 (업무 맥락 + 문제 상황)
- 문장 2: 이 클립에서 뭘 건질 수 있는지 (구체적 표현이나 구조)
- ~거든요, ~인데요 같은 구어 연결 OK.

좋은 예시:
{"title": "숫자 꺼내기 전에 '왜'부터 까는 법", "description": "지표를 그냥 읽으면 아무도 안 듣거든요. 숫자에 맥락을 입히는 한 문장 패턴을 연습해요."}
{"title": "반대 의견, 'But' 없이 꺼내는 세 가지 방법", "description": "회의에서 반대할 때 분위기 안 깨는 구조가 있어요. I see your point 계열의 완충 표현을 익혀요."}
{"title": "3분 안에 프로젝트 근황 정리하는 패턴", "description": "스탠드업이나 위클리에서 바로 쓸 수 있는 요약 구조예요. 핵심-진행-다음단계 순서로 연습해요."}

나쁜 예시 (절대 이렇게 쓰지 말 것):
{"title": "효과적인 비즈니스 커뮤니케이션 전략", "description": "이 세션에서는 비즈니스 상황에서 효과적으로 의사소통하는 방법을 학습합니다."}
{"title": "키노트를 활용한 전략적 발표 기법", "description": "프레젠테이션에서 핵심 메시지를 전략적으로 전달하는 역량을 키울 수 있습니다."}

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
