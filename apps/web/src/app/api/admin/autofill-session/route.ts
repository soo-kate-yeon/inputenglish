import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  GENRES,
  SESSION_ROLE_RELEVANCE,
  SESSION_SOURCE_TYPES,
  type Genre,
  type Sentence,
  type SessionRoleRelevance,
  type SessionSourceType,
} from "@inputenglish/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface AutofillResponse {
  title: string;
  subtitle: string;
  description: string;
  sourceType?: SessionSourceType;
  genre?: Genre;
  roleRelevance?: SessionRoleRelevance[];
  premiumRequired?: boolean;
}

const COPY_FEW_SHOTS = [
  {
    title: "샘 알트만 AI 전망 발표",
    subtitle: "숫자를 말할 때 'We're seeing'으로 단정 피하는 연습이에요.",
    description:
      "지표를 꺼낼 때 너무 세게 말하면 부담스럽게 들릴 때가 있거든요. 관찰형 표현으로 숫자를 부드럽게 설명하는 흐름을 가져가요.",
  },
  {
    title: "코난 오브라이언 팟캐스트",
    subtitle:
      "처음 만난 사람한테 'So tell me about...'으로 자연스럽게 말을 꺼내봐요.",
    description:
      "대화를 시작해야 하는데 어색할 때가 있거든요. 상대가 편하게 이어서 말하게 만드는 오프닝 패턴을 건져가요.",
  },
  {
    title: "조나단 앤더슨 인터뷰",
    subtitle: "선을 그어야 할 때 'this is the line'으로 분명하게 말해봐요.",
    description:
      "기준을 분명히 해야 하는 순간이 꼭 생기거든요. 부드럽지만 물러서지 않는 말투를 이 장면에서 가져가요.",
  },
  {
    title: "엔비디아 실적 발표",
    subtitle:
      "좋은 흐름을 짚을 때 'continued strength'로 자신감 있게 말해봐요.",
    description:
      "실적이나 성장 흐름을 설명할 때 톤이 흔들리면 메시지가 약해지거든요. 짧고 단단하게 상승세를 묶는 표현을 익혀가요.",
  },
  {
    title: "제이미 다이먼 인터뷰",
    subtitle: "우려를 남길 때 'the risk is that...'으로 차분하게 짚어봐요.",
    description:
      "낙관만 하면 설득력이 떨어질 때가 있거든요. 리스크를 빼지 않고 말에 균형을 주는 구조를 이 클립에서 가져가요.",
  },
  {
    title: "마크 저커버그 메타 키노트",
    subtitle: "다음 변화를 말할 때 'the next step is...'로 흐름을 넘겨봐요.",
    description:
      "발표에서 다음 장면으로 넘어갈 때 말이 끊기기 쉽거든요. 지금 설명에서 다음 액션으로 자연스럽게 넘기는 연결 표현이에요.",
  },
  {
    title: "젠데이아 Vogue 인터뷰",
    subtitle: "생각을 고를 때 'I think for me...'로 내 쪽 얘기를 열어봐요.",
    description:
      "개인적인 생각을 말할 때 너무 단정적으로 들릴 수 있거든요. 자기 관점으로 톤을 부드럽게 여는 방식을 건져가요.",
  },
  {
    title: "버락 오바마 대담",
    subtitle: "쟁점을 넓힐 때 'the broader point is...'로 시야를 바꿔봐요.",
    description:
      "한 포인트에만 머물면 말이 작아 보일 때가 있거든요. 지금 얘기에서 한 단계 큰 맥락으로 옮겨가는 흐름을 익혀가요.",
  },
  {
    title: "세포라 CEO 인터뷰",
    subtitle: "고객 반응을 짚을 때 'what we heard was...'로 근거를 붙여봐요.",
    description:
      "사용자 반응을 말할 때 출처가 흐리면 힘이 빠지거든요. 들은 내용을 근거처럼 붙이는 말하기 리듬을 가져가요.",
  },
  {
    title: "루이 비통 아틀리에 다큐",
    subtitle: "집중 포인트를 짚을 때 'what matters is...'로 중심을 세워봐요.",
    description:
      "설명이 길어질수록 뭐가 중요한지 흐려지기 쉽거든요. 여러 정보 중 핵심만 다시 세우는 표현을 이 장면에서 익혀가요.",
  },
];

function formatFewShotExamples() {
  return COPY_FEW_SHOTS.map((example) => JSON.stringify(example)).join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const { sentences, videoTitle, targetPattern, primarySpeakerName } =
      await request.json();

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
    const primarySpeakerLine = primarySpeakerName
      ? `대표 화자 이름: "${String(primarySpeakerName).trim()}"`
      : "";

    const targetPatternSection = targetPattern
      ? `
⚠️ 핵심 규칙: 변형연습에서 "${targetPattern}" 패턴이 이미 선택되었다.
이 세션의 학습 초점은 이 패턴이다. 기본정보 전체를 이 패턴 중심으로 작성해라:
- title: 영상 제목 기반으로 하되, 이 패턴이 나오는 맥락을 반영
- subtitle: 반드시 '${targetPattern}' 표현을 포함한 완성 문장
- description: 이 패턴이 왜 유용한지, 어디서 쓸 수 있는지 중심으로 작성
- genre: 이 패턴이 나오는 콘텐츠 분야에 맞춰 선택
- AI Scene Generation 결과는 무시하고, 이 패턴과 트랜스크립트에서 직접 판단해라.
`
      : "";

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
- genre: ${GENRES.join(", ")}
- roleRelevance: ${SESSION_ROLE_RELEVANCE.join(", ")}

genre 판단 기준 — 이 클립의 주제/분야가 뭔지 보고 골라라:
- politics: 정치, 외교, 정부, 선거 관련
- fashion: 패션, 스타일, 의류, 트렌드 관련
- tech: 기술, AI, 소프트웨어, 하드웨어 관련
- economy: 경제, 금융, 주식, 투자 관련
- current-affairs: 시사, 사회 이슈, 뉴스 배경 관련
- news: 뉴스, 보도, 언론 관련
- beauty: 뷰티, 화장품, 스킨케어 관련
- art: 예술, 문화, 창작, 디자인 관련
- business: 비즈니스, 창업, 경영, 마케팅 관련

${videoTitleLine}
${primarySpeakerLine}
${targetPatternSection}

Title rules:
- 제목은 영상의 정체가 바로 보여야 한다.
- 가능하면 "인물 이름 + 콘텐츠명/주제" 구조로 쓴다.
- 대표 화자 이름이 있으면 어색하지 않을 때 제목 앞에 자연스럽게 넣는다.
- 길이는 16~22자 정도로 짧게 쓴다.
- 같은 영상에서 여러 세션이 나올 수 있으니, 이 세션 구간의 포인트가 드러나야 한다.
- "배우는 법", "소통", "전략", "표현 익히기", "영어", "말하기" 같은 뭉툭한 제목은 쓰지 마라.
- 제목만 봐도 어떤 영상인지 상상돼야 한다.

Subtitle rules:
- 완성된 한국어 문장으로 쓸 것. 명사구나 어구로 끊으면 안 됨.
- 영어 표현(작은따옴표로 감싸기)을 포함한 완성 문장.
- ~해요, ~연습해요, ~말하기를 익혀요 같은 서술어로 마무리.
- 구체적 상황 + 영어 표현 + 말하기 행위가 한 문장에 담기면 이상적.
- 좋은 예: "더 좋은 기회에 'said no to' 패턴으로 거절하는 말하기를 연습해요."
- 좋은 예: "숫자를 꺼낼 때 'We're seeing'으로 단정을 피하는 법을 연습해요."
- 좋은 예: "처음 만난 사람한테 'So tell me about...'으로 자연스럽게 말 꺼내는 연습이에요."
- 나쁜 예: "'said no to' 패턴으로 거절하기" (← 문장 미완성)
- 나쁜 예: "단정 피하는 관찰형 표현" (← 명사구, 서술어 없음)

Description rules:
- 최대 2문장 한국어.
- 문장 1: 이 표현/패턴이 실제로 어디서 쓰이는지 (구체적 상황 — 회의실 밖도 OK)
- 문장 2: 이 클립에서 뭘 건질 수 있는지 (구체적 표현이나 구조)
- ~거든요, ~인데요 같은 구어 연결 OK.

좋은 예시 (이 톤과 밀도로 맞춰라):
${formatFewShotExamples()}

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
  "genre": "one of allowed enums",
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

    autofillData.genre = GENRES.includes(autofillData.genre as Genre)
      ? (autofillData.genre as Genre)
      : undefined;

    autofillData.roleRelevance = (autofillData.roleRelevance ?? []).filter(
      (role): role is SessionRoleRelevance =>
        SESSION_ROLE_RELEVANCE.includes(role as SessionRoleRelevance),
    );

    if (autofillData.roleRelevance.length === 0) {
      autofillData.roleRelevance = ["pm"];
    }

    autofillData.premiumRequired = Boolean(autofillData.premiumRequired);

    return NextResponse.json(autofillData);
  } catch (error: unknown) {
    console.error("Session autofill API error:", error);
    return NextResponse.json(
      { error: "Failed to autofill session details" },
      { status: 500 },
    );
  }
}
