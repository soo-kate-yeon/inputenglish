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
  subtitle: string;
  description: string;
  sourceType?: SessionSourceType;
  speakingFunction?: SessionSpeakingFunction;
  roleRelevance?: SessionRoleRelevance[];
  premiumRequired?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { sentences, videoTitle } = await request.json();

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

    const videoTitleLine = videoTitle ? `원본 영상 제목: "${videoTitle}"` : "";

    const prompt = `
You are writing session copy for an English speaking practice app.
Users watch short clips from real English content and practice speaking patterns from them.

Voice & tone:
- 한국어로 작성. 구어체 허용 (~거든요, ~인데요, ~해요, ~이에요)
- 짧고 직접적. 한 문장에 하나의 정보만.
- 담백하고 건조하게. 감탄사, 과장, 동기부여 금지.

금지 표현 (이런 단어가 나오면 다시 써라):
- "효과적인", "전략적으로", "핵심 역량", "활용하여"
- "~를 학습합니다", "~할 수 있습니다", "~를 익혀보세요"
- "이 세션에서는", "함께 살펴보겠습니다", "실력을 키워보세요"
- "커뮤니케이션 스킬", "비즈니스 영어", "글로벌 역량", "업무 영어"
- "직장인", "오피스", "프로페셔널"

Allowed enums:
- sourceType: ${SESSION_SOURCE_TYPES.join(", ")}
- speakingFunction: ${SESSION_SPEAKING_FUNCTIONS.join(", ")}
- roleRelevance: ${SESSION_ROLE_RELEVANCE.join(", ")}

speakingFunction 판단 기준 — 화자가 이 클립에서 실제로 하는 말하기 행위가 뭔지 보고 골라라:
- persuade: 상대를 설득하거나 동의를 구하는 말하기
- explain-metric: 숫자나 데이터를 설명하는 말하기
- summarize: 핵심을 정리하거나 요약하는 말하기
- hedge: 단정을 피하고 조심스럽게 표현하는 말하기
- disagree: 반대 의견을 내거나 다른 시각을 제시하는 말하기
- propose: 아이디어나 방안을 제안하는 말하기
- answer-question: 질문에 답하거나 입장을 밝히는 말하기
- buy-time: 즉답하지 않고 생각할 시간을 만드는 말하기 ("That's a great question, let me think...")
- clarify: 상대 말을 확인하거나 되묻는 말하기 ("Just to make sure I'm on the same page...")
- recover: 말 실수나 오해를 바로잡는 말하기 ("Sorry, let me rephrase that...")
- build-rapport: 관계를 만들거나 가볍게 대화를 이어가는 말하기
- redirect: 대화 흐름을 바꾸거나 원래 주제로 돌아오는 말하기

${videoTitleLine}

Title rules:
- 원본 영상 제목을 기반으로 한국어 제목을 만들어라. 인물 이름 + 콘텐츠명/주제 형식이 좋음.
- 한 줄. 20자 내외.
- 영상이 뭔지 바로 알 수 있어야 함. 이게 세션의 얼굴임.
- 같은 영상에서 여러 세션이 나올 수 있으니, 이 세션이 다루는 부분에 집중.

Subtitle rules:
- 이 세션의 핵심 표현이나 말하기 패턴을 한 줄로.
- 영어 표현이 들어가면 좋음.
- 20자 내외.
- 이 세션에서 연습할 구체적인 표현/패턴이 뭔지 보여주는 역할.

Description rules:
- 최대 2문장 한국어.
- 문장 1: 이 표현/패턴이 실제로 어디서 쓰이는지 (구체적 상황 — 회의실 밖도 OK)
- 문장 2: 이 클립에서 뭘 건질 수 있는지 (구체적 표현이나 구조)
- ~거든요, ~인데요 같은 구어 연결 OK.

좋은 예시:
{"title": "조나단 앤더슨 The System 인터뷰", "subtitle": "'this is the line'으로 분명하게 선 긋기", "description": "변화가 필요한 순간에 선을 긋는 표현이 있거든요. 갈등을 회피하지 않고 분명하게 말하는 패턴을 연습해요."}
{"title": "샘 알트만 AI 전망 발표", "subtitle": "'We're seeing' 으로 단정 피하기", "description": "숫자를 말할 때 단정 짓지 않는 게 중요하거든요. 관찰형 표현으로 자연스럽게 데이터를 전달하는 패턴을 연습해요."}
{"title": "코난 오브라이언 팟캐스트", "subtitle": "'So tell me about...'으로 자연스럽게 말 꺼내기", "description": "처음 만난 사람한테 뭘 물어봐야 할지 막막할 때가 있거든요. 상대가 말하게 만드는 자연스러운 오프닝 패턴이에요."}

나쁜 예시 (절대 이렇게 쓰지 말 것):
{"title": "효과적인 비즈니스 커뮤니케이션 전략", "subtitle": "전략적 의사소통 역량 강화", "description": "이 세션에서는 비즈니스 상황에서 효과적으로 의사소통하는 방법을 학습합니다."}
{"title": "리더십과 소통", "subtitle": "핵심 역량 활용", "description": "직장인이 프로페셔널하게 의견을 전달하는 스킬을 익혀보세요."}

Transcript excerpt:
"${sentencesText}"

Return ONLY valid JSON:
{
  "title": "string",
  "subtitle": "string",
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

    autofillData.subtitle = autofillData.subtitle?.trim() || "";

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
