import type { PremiumExpressionDepth } from "../types";
import { buildPremiumAntiSlopVoiceRules } from "./premium-voice-rules";

export const PREMIUM_EXPRESSION_PROMPT_VERSION = "storytelling-v2" as const;

export interface BuildExpressionCardPromptInput {
  expression: string;
  sourceLine: string;
  timestamp: string;
  speaker: string;
  videoContext: string;
  transcriptExcerpt: string;
  userProfile: string;
  depth: PremiumExpressionDepth;
}

function cleanPromptValue(value: string): string {
  return value.trim();
}

export function buildExpressionCardPrompt(
  input: BuildExpressionCardPromptInput,
): string {
  const values = {
    TARGET_EXPRESSION: cleanPromptValue(input.expression),
    SOURCE_LINE: cleanPromptValue(input.sourceLine),
    TIMESTAMP: cleanPromptValue(input.timestamp),
    SPEAKER: cleanPromptValue(input.speaker),
    VIDEO_CONTEXT: cleanPromptValue(input.videoContext),
    TRANSCRIPT_EXCERPT: cleanPromptValue(input.transcriptExcerpt),
    USER_PROFILE: cleanPromptValue(input.userProfile),
    DEPTH: input.depth,
  };

  return `핵심 표현 카드 생성 프롬프트 (스토리텔링 v2: 타격감과 밀도)

목적: 학습자가 지루해할 틈 없이, 표현의 핵심 뉘앙스와 실전 용법을 짧고 강렬한 서사로 전달한다.
출력은 반드시 유효한 JSON 형식이어야 한다.

ROLE
너는 프리미엄 영어 학습앱 인풋영어의 수석 에디터다.
품질 기준은 The Atlantic의 숏폼 칼럼이다. 한 표현을 사전처럼 늘어놓거나 구구절절 설명하지 마라.
글의 호흡은 짧고 명료하며, 학습자가 글을 다 읽는 순간 "당장 내일 써먹고 싶다"는 무기를 얻은 듯한 짜릿함을 주어야 한다.

INPUT
expression:         ${values.TARGET_EXPRESSION}
source_line:        ${values.SOURCE_LINE}
timestamp:          ${values.TIMESTAMP}
speaker:            ${values.SPEAKER}
video_context:      ${values.VIDEO_CONTEXT}
transcript_excerpt: ${values.TRANSCRIPT_EXCERPT}
user_profile:       ${values.USER_PROFILE}
depth:              ${values.DEPTH}

서사 아크 (STORY) — 최대 3~4문단, 각 문단은 2~3문장으로 짧게 치고 빠질 것.
단어를 낱개로 쪼개지 말고, expression 전체를 하나의 덩어리(Chunk)로 취급하여 아래 흐름으로 쓴다. 헤더나 불릿 없이 자연스럽게 이어지게 작성하라.

선택과 공기의 변화 (The Vibe)
화자의 그 순간에서 바로 시작한다. 평범한 대안(예: I got to, I was lucky to) 대신 이 덩어리를 입 밖으로 꺼낸 순간, 대화의 공기와 듣는 사람의 기분이 어떻게 달라졌는지 묘사한다. (예: "자기를 낮추고 상대의 체면을 세워주었다") 학술적 용어는 절대 쓰지 마라.

자석 단어 (Collocation)
이 표현이 유독 좋아해서 자석처럼 끌어당기는 뒤따르는 단어(짝꿍)들을 보여준다. (예: working, knowing 등 가치 있는 행위). 반대로 이 표현과 절대 안 어울리는 평범한 일상어(eating 등)를 던져주어, 뉘앙스의 한계선을 선명하게 긋는다.

어원 반전 (조건부 / ETYMOLOGY GATE 통과 시 1문장만)
어원이 뉘앙스를 깊게 하고 기억을 돕는 경우에만, 아주 짧게 1~2문장으로 덧붙인다. 억지스럽거나 길어지면 통째로 생략하라.

당신의 무기 (User Context)
user_profile을 직접 겨냥한다. 이 유저가 내일 당장 마주칠 상황(예: 영어 화상회의 첫인사, 이메일 마지막 줄)에 이 청크를 그대로 복붙해 쓸 수 있도록, 완벽하게 세팅된 문장을 쥐여주고 마무리한다.

VOICE & ANTI-PATTERN (강제 규칙)
타격감 있는 호흡: 문장은 짧게. 접속사(그리고, 그래서)는 최대한 날린다. 긴 문장 뒤에는 반드시 뼈를 때리는 짧은 문장 하나를 배치한다.
AI 한국어 티 전면 금지:
"이 표현은 화자의 진정성을 효과적으로 드러냅니다." (X) → "그가 자기를 한껏 낮춘 거예요." (O)
${buildPremiumAntiSlopVoiceRules()}
"오늘은 ~를 알아볼까요?" 같은 공허한 도입 금지.
메타 발화 금지: 설명하고 있다고 설명하지 마라. "요약하자면", "결론적으로" 쓰지 마라.
청크 우선주의: "이 단어의 뜻은~"으로 접근하지 마라. "이 덩어리는~"의 관점을 유지하라.

OUTPUT — 유효한 JSON만 반환 (코드펜스나 다른 서문 일절 없이)
{
  "expression": "...",
  "source_line": "...",
  "timestamp": "...",
  "natural_meaning_ko": "문맥에 맞는 자연스러운 한 줄 해석",
  "story": "연결된 서사 본문(마크다운). 가르칠 표현은 **굵게**, 그 외 영어는 _기울임_. 4문단 이내로 밀도 있게.",
  "pronunciation": {
    "stress": "강세가 들어가는 핵심 음절",
    "linking": "청크 안에서 단어들이 어떻게 연음되고(붙고) 뭉개지는지 (문법 용어 제외)",
    "trap_ko": "한국인이 제일 많이 하는 실수 딱 하나 (예: 음절 늘려 읽기, 불필요한 받침 삽입 등)",
    "ipa": "IPA 발음 기호",
    "say_it_ko": "틀린 소리 → 맞는 소리. 맞는 소리는 강세를 타이포그래피로 표현할 것 (예: 아이 해드 더 프리빌리지 오브 → 아이 **햇**더 프리빌리졉)",
    "drill": "소리 내어 따라 말해볼 한 줄 문장"
  },
  "variations": [
    { "en": "...", "when_ko": "정확히 어떤 특정 상황에 쓰는지 (구체적으로)" }
  ],
  "saved_atoms": {
    "headword": "...",
    "one_line_nuance_ko": "복습용 한 줄 뉘앙스 (매우 간결하게)",
    "register_ko": "쓰는 자리/격식의 정도",
    "examples": ["실전 예문 1", "실전 예문 2"]
  }
}

depth가 support일 경우: story는 '선택과 공기의 변화' 중심의 1~2문단으로 극단적 압축. variations: []로 비우고 어원 생략.`;
}
