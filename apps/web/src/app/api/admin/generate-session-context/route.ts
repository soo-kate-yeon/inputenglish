import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SESSION_SPEAKING_FUNCTIONS,
  type CommonMistake,
  type KeyVocabularyEntry,
  type Sentence,
  type SessionContext,
  type SessionSpeakingFunction,
} from "@inputenglish/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

interface GenerateContextRequest {
  title: string;
  description?: string;
  speakingFunction?: SessionSpeakingFunction;
  sentences: Sentence[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateContextRequest;
    const { title, description, speakingFunction, sentences } = body;

    if (!title || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "title and sentences are required" },
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
세션 학습 브리프를 한국어로 작성해.

이 브리프는 학습자가 클립을 듣기 전에 "이 사람이 왜 이렇게 말했는지"를 이해하도록 돕는 짧은 안내문이야.
핵심은 말하기 목적이야 — 설득인지, 반대인지, 요약인지, 스몰토크인지. 그 목적에 맞는 표현과 패턴을 짚어줘.

톤:
- 옆에서 짧게 설명하듯. 교과서 말투 금지.
- 구어체 OK (~거든요, ~인데요, ~이에요, ~해요)
- 한 필드에 한 가지 정보만. 짧게.

금지 표현:
- "효과적으로", "전략적으로", "활용하여", "핵심 역량"
- "~할 수 있습니다", "~를 보여준다", "~를 부여한다"
- "학습자는", "본 세션에서는"
- "비즈니스 영어", "업무 영어", "커뮤니케이션 스킬", "글로벌 역량"
- "직장인", "오피스", "프로페셔널"
- ~다 로 끝나는 문어체 종결 (→ ~이에요, ~거든요, ~해요 로 바꿀 것)

허용된 speaking function:
${SESSION_SPEAKING_FUNCTIONS.join(", ")}

세션 제목: ${title}
세션 설명: ${description ?? ""}
speaking function 힌트: ${speakingFunction ?? ""}

트랜스크립트:
${transcript}

각 필드 작성 가이드와 예시:

speaking_function — 허용 enum 중 하나.

reusable_scenarios — 이 표현/패턴을 실제로 쓸 수 있는 구체적 상황 2-3개. 짧은 한국어 구.
  회의실 밖의 일상 상황도 포함해서 생각할 것.
  좋은 예: ["친구한테 근황 설명할 때", "모임에서 의견 다를 때", "발표에서 숫자 언급할 때", "처음 만난 사람과 대화할 때"]
  나쁜 예: ["비즈니스 미팅", "프레젠테이션"] (← 너무 뭉뚱그림)

key_vocabulary — 이 클립에서 건질 수 있는 핵심 표현 3-5개.
  각 표현에 예문 + 한국어 번역 + 발음 힌트를 붙일 것.
  형식: [{"expression": "영어 표현", "example": "트랜스크립트에서 가져온 예문 한 문장", "translation": "자연스러운 한국어 번역", "pronunciation_note": "강세나 연음 힌트 (선택)"}]
  좋은 예: [
    {"expression": "We're seeing", "example": "We're seeing strong momentum across all segments.", "translation": "전 부문에서 강한 성장세가 보이고 있습니다.", "pronunciation_note": "'위어씨잉'처럼 연결. seeing에 강세."},
    {"expression": "That's a signal that", "example": "That's a signal that the market is shifting.", "translation": "시장이 움직이고 있다는 신호예요."}
  ]
  나쁜 예: ["communication", "strategy"] (← 구조 없이 단어만, 너무 일반적)
  번역 톤: 직역 금지. 실제로 말하듯 자연스럽게.
  예문 규칙: 반드시 대문자로 시작할 것.

grammar_rhetoric_note — 문장 구조나 수사법에 대한 실용 노트 하나.
  한국어 화자가 이 구조를 왜 어려워하는지도 짚어줄 것.
  좋은 예: "'We're seeing X' 같은 관찰형 표현은 한국어에 직접 대응하는 구조가 없어서, 익숙해지기 전까지는 'I think X is increasing' 같은 직역을 하게 돼요"
  좋은 예: "결론 → 근거 → 다음 액션 순서로 말하는 3단 구조예요"
  나쁜 예: "관찰 기반 설명을 유지한다" (← 문어체, 모호)

common_mistakes — 이 표현을 쓸 때 한국어 화자가 자주 하는 실수 1-2개.
  형식: [{"mistake": "한국인이 하는 실수", "correction": "자연스러운 표현", "why": "왜 틀리는지 (한국어)"}]
  좋은 예: [{"mistake": "I'm seeing strong momentum", "correction": "We're seeing strong momentum", "why": "한국어는 '나는'이 기본이라 자동으로 I를 쓰게 되는데, 이 패턴에선 관찰 주체를 we로 쓰는 게 관례예요"}]
  힌트: 관사 누락, 시제 혼용, 직역으로 인한 어색함, too-direct 표현 등에서 찾을 것.

expected_takeaway — 이 세션 후 학습자가 할 수 있는 것 한 문장. 구체적인 상황 + 표현을 넣어라.
  좋은 예: "숫자를 꺼낼 때, 의미부터 말하고 수치를 붙일 수 있어요"
  좋은 예: "반대할 때 'I think differently' 대신 완충 표현을 쓸 수 있어요"
  좋은 예: "처음 만난 사람한테 자기소개할 때 자연스러운 오프닝을 쓸 수 있어요"
  나쁜 예: "지표를 설명할 수 있다" (← 너무 짧고 뻔함)

Return ONLY valid JSON:
{
  "speaking_function": "one allowed enum",
  "reusable_scenarios": ["string", "string"],
  "key_vocabulary": [{"expression": "string", "example": "string", "translation": "string", "pronunciation_note": "string or omit"}, ...],
  "grammar_rhetoric_note": "string",
  "common_mistakes": [{"mistake": "string", "correction": "string", "why": "string"}],
  "expected_takeaway": "string"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.debug("[SessionContext] raw AI response:", responseText);
    const cleanedText = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText) as SessionContext;

    if (!parsed.expected_takeaway) {
      throw new Error("Invalid context response structure");
    }

    const normalizedFunction = SESSION_SPEAKING_FUNCTIONS.includes(
      parsed.speaking_function as SessionSpeakingFunction,
    )
      ? (parsed.speaking_function as SessionSpeakingFunction)
      : (speakingFunction ?? "summarize");

    const reusableScenarios = Array.isArray(parsed.reusable_scenarios)
      ? parsed.reusable_scenarios
          .map((scenario) => scenario?.trim())
          .filter(Boolean)
      : [];

    const keyVocabulary: (string | KeyVocabularyEntry)[] = Array.isArray(
      parsed.key_vocabulary,
    )
      ? parsed.key_vocabulary.reduce<(string | KeyVocabularyEntry)[]>(
          (acc, item) => {
            if (typeof item === "string") {
              const trimmed = item.trim();
              if (trimmed) acc.push(trimmed);
            } else if (
              item &&
              typeof item === "object" &&
              "expression" in item
            ) {
              const expr = (item.expression ?? "").trim();
              if (expr) {
                const entry: KeyVocabularyEntry = {
                  expression: expr,
                  example: capitalize((item.example ?? "").trim()),
                };
                const tr = (item.translation ?? "").trim();
                if (tr) entry.translation = tr;
                const pn = (item.pronunciation_note ?? "").trim();
                if (pn) entry.pronunciation_note = pn;
                acc.push(entry);
              }
            }
            return acc;
          },
          [],
        )
      : [];

    const commonMistakes: CommonMistake[] = Array.isArray(
      parsed.common_mistakes,
    )
      ? parsed.common_mistakes
          .filter(
            (m): m is CommonMistake =>
              m &&
              typeof m === "object" &&
              typeof m.mistake === "string" &&
              typeof m.correction === "string" &&
              typeof m.why === "string",
          )
          .map((m) => ({
            mistake: m.mistake.trim(),
            correction: m.correction.trim(),
            why: m.why.trim(),
          }))
      : [];

    return NextResponse.json({
      speaking_function: normalizedFunction,
      reusable_scenarios: reusableScenarios,
      key_vocabulary: keyVocabulary,
      grammar_rhetoric_note: parsed.grammar_rhetoric_note?.trim() ?? "",
      common_mistakes: commonMistakes.length > 0 ? commonMistakes : undefined,
      expected_takeaway: parsed.expected_takeaway.trim(),
      generated_by: "gemini",
    } satisfies SessionContext);
  } catch (error: any) {
    console.error("Session context generation API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate session context" },
      { status: 500 },
    );
  }
}
