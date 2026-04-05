// @MX:NOTE: [AUTO] Gemini-powered transformation exercise generation v2 (SPEC-MOBILE-011).
// Selects the pattern most aligned with expected_takeaway and generates context-aware exercises.
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  CommonMistake,
  KeyVocabularyEntry,
  Sentence,
} from "@inputenglish/shared";

interface GenerateTransformationRequest {
  sessionId: string;
  sentences: Sentence[];
  speakingFunction?: string;
  expectedTakeaway?: string;
  keyVocabulary?: (string | KeyVocabularyEntry)[];
  commonMistakes?: CommonMistake[];
}

interface GeneratedExercise {
  page_order: number;
  exercise_type: string;
  instruction_text: string;
  source_korean?: string;
  question_text?: string;
  situation_text?: string;
  dialog_lines?: Array<{ speaker: string; text: string; is_blank: boolean }>;
  reference_answer?: string;
}

interface GenerateTransformationResponse {
  set: {
    target_pattern: string;
    pattern_type: string;
    pattern_rationale?: string;
  };
  exercises: GeneratedExercise[];
}

function formatKeyVocab(items?: (string | KeyVocabularyEntry)[]): string {
  if (!items || items.length === 0) return "없음";
  return items
    .map((item) => {
      if (typeof item === "string") return `- ${item}`;
      return `- ${item.expression} (예: ${item.example})`;
    })
    .join("\n");
}

function formatCommonMistakes(mistakes?: CommonMistake[]): string {
  if (!mistakes || mistakes.length === 0) return "없음";
  return mistakes
    .map(
      (m) =>
        `- 실수: "${m.mistake}" → 교정: "${m.correction}" (이유: ${m.why})`,
    )
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateTransformationRequest;
    const {
      sessionId,
      sentences,
      speakingFunction,
      expectedTakeaway,
      keyVocabulary,
      commonMistakes,
    } = body;

    if (!sessionId || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "sessionId and sentences are required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const transcript = sentences.map((s) => s.text).join(" ");

    const prompt = `
아래 영어 트랜스크립트에서 변형 연습 문제 세트를 만들어.

대상: 영어로 일하는 한국인. 원어민처럼 유창하진 않지만 기초는 되는 사람.
목적: 하나의 패턴을 다양한 상황에서 말해보면서 체화하는 것.

━━ 세션 컨텍스트 ━━
학습 기대효과: ${expectedTakeaway ?? "없음"}
말하기 목적: ${speakingFunction ?? "없음"}
핵심 표현:
${formatKeyVocab(keyVocabulary)}
한국인 실수 패턴:
${formatCommonMistakes(commonMistakes)}

━━ 트랜스크립트 ━━
"${transcript}"

━━ Step 1: 타깃 패턴 선택 ━━
트랜스크립트의 표현들 중에서 아래 기준으로 하나의 핵심 패턴을 골라라:

⚠️ 최우선 규칙: 핵심 표현(key_vocabulary) 목록에 있는 표현 중에서 골라라.
key_vocabulary에서 고를 수 없는 경우(단어 수준이라 변형이 불가능하거나, 구조적 패턴이 아닌 경우)에만 트랜스크립트에서 자유 선택하되, pattern_rationale에 key_vocabulary에서 고르지 않은 이유를 명시해라.

선택 기준 (우선순위 순):
1. 핵심 표현(key_vocabulary)에 포함된 것 (최우선 — 세션 브리핑과 일관성 유지)
2. 학습 기대효과(expected_takeaway)에 가장 직결되는 표현
3. 변형 가능성이 높은 것 — 주어, 목적어, 시제를 바꿔도 구조가 유지됨
4. 회의실 밖 일상 상황에서도 재사용 빈도가 높은 것
5. 한국어 직역으로는 나오기 어려운 영어다운 구조

pattern_rationale: 이 패턴을 고른 이유를 한국어로 1-2문장.

pattern_type 선택:
- declarative: 선언/서술 구조
- interrogative: 질문 구조
- framing: 맥락 먼저 깔기 ("What we're seeing is...")
- hedging: 완화/단정 피하기 ("I would say...", "It seems like...")
- transitioning: 전환·되돌리기 ("Going back to...", "That said...")
- responding: 즉흥 대응 ("That's a great point...", "Let me think about that...")

━━ Step 2: 문제 구성 ━━
선택한 패턴을 익히기 위한 문제 4개를 만들어라.

speaking_function에 따른 권장 조합:
- buy-time / recover / build-rapport:
  kr-to-en ×1, situation-response ×2, dialog-completion ×1
- explain-metric / summarize / persuade / propose:
  kr-to-en ×2, qa-response ×1, dialog-completion ×1
- disagree / hedge / redirect / clarify:
  kr-to-en ×1, qa-response ×1, dialog-completion ×2
- 그 외 / speakingFunction 없음:
  kr-to-en ×2, qa-response ×1, dialog-completion ×1

문제 유형별 가이드:

kr-to-en:
- 타깃 패턴을 쓰게 유도하는 한국어 문장
- 한국어가 자연스러워야 함 (번역투 금지 — 실제 한국인이 하는 말처럼)
- 같은 패턴이되 상황/맥락을 다르게 할 것
- 공통 실수 패턴(common_mistakes)이 있으면 그 실수를 안 하게 유도하는 문장 우선

qa-response:
- 영어 질문에 타깃 패턴을 써서 답하기
- 질문은 회의, 1:1 대화, 처음 만난 자리 등 실제 상황에서 나올 법한 것
- 질문이 업무용일 필요 없음 — 상황이 구체적이면 됨

situation-response:
- 상황 설명 → 영어로 말하기
- "당신은 ~한 상황입니다. 뭐라고 말하겠어요?" 형식
- build-rapport, recover, buy-time에 특히 적합
- 상황은 생생하고 구체적으로 (장소, 대화 상대, 맥락 포함)

dialog-completion:
- 2-3턴 대화에서 빈칸(is_blank: true) 1개 채우기
- 빈칸에 타깃 패턴이 들어가야 함
- 대화가 자연스럽고 실제처럼 느껴져야 함

━━ 금지사항 ━━
- instruction_text에 "효과적으로", "전략적으로", "활용하여" 금지
- 모든 instruction은 짧고 직접적인 한국어로 (구어체 OK)
- source_korean이 번역투면 안 됨 — 실제 한국인이 하는 말처럼
- "비즈니스 상황에서" 같은 프레이밍 금지. 구체적 상황을 줄 것.
- 모든 문제에 reference_answer를 반드시 포함할 것

Return ONLY valid JSON (no markdown):
{
  "set": {
    "target_pattern": "타깃 패턴 (영어 표현)",
    "pattern_type": "framing | hedging | transitioning | responding | declarative | interrogative",
    "pattern_rationale": "이 패턴을 고른 이유 (한국어, 1-2문장)"
  },
  "exercises": [
    {
      "page_order": 2,
      "exercise_type": "kr-to-en | qa-response | dialog-completion | situation-response",
      "instruction_text": "한국어 지시문",
      "source_korean": "...",
      "question_text": "...",
      "situation_text": "...",
      "dialog_lines": [{"speaker": "string", "text": "string", "is_blank": false}],
      "reference_answer": "모범 답안 (영어)"
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as GenerateTransformationResponse;

    // Validate structure
    if (!parsed.set || !Array.isArray(parsed.exercises)) {
      return NextResponse.json(
        { error: "Invalid AI response structure" },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[generate-transformation] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
