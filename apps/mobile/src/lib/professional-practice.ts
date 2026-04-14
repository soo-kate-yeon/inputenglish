import type {
  PlaybookMasteryStatus,
  PracticeCoachingSummary,
  PracticeMode,
  PracticePrompt,
  SessionContext,
  SessionRoleRelevance,
} from "@inputenglish/shared";
import { PRACTICE_MODE_LABELS } from "./professional-labels";

interface DefaultPracticePromptInput {
  sessionId: string;
  title: string;
  description?: string;
  roleRelevance?: SessionRoleRelevance[];
  context?: SessionContext | null;
  userDisplayName?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  engineer: "엔지니어",
  pm: "PM",
  designer: "디자이너",
  founder: "창업가",
  marketer: "마케터",
};

export function buildSlotTemplate(sourceSentence: string): string {
  const words = sourceSentence.split(/\s+/);
  let replaced = 0;

  return words
    .map((word) => {
      const normalized = word.replace(/[^A-Za-z]/g, "");
      if (replaced < 2 && normalized.length >= 6) {
        replaced += 1;
        return `[${normalized.toLowerCase()}]`;
      }
      return word;
    })
    .join(" ");
}

export function buildDefaultPracticePrompts(
  input: DefaultPracticePromptInput,
): Omit<PracticePrompt, "id" | "created_at" | "updated_at">[] {
  const scenario =
    input.context?.reusable_scenarios?.[0] ??
    input.description ??
    "짧은 상황 설명";
  const userLabel = input.userDisplayName?.trim()
    ? input.userDisplayName.trim()
    : "나";
  const roleLabel = input.roleRelevance?.[0]
    ? ROLE_LABELS[input.roleRelevance[0]]
    : "실무자";
  const takeawayHint =
    input.context?.expected_takeaway ??
    "메시지는 구체적이고 차분하며 자연스럽게 들리게 유지하세요.";

  return [
    {
      session_id: input.sessionId,
      mode: "slot-in",
      title: "패턴 끼워 넣기",
      prompt_text: `문장 골격은 유지하고 업무 정보만 바꿔 써보세요. 명확한 설명에 집중하면서 원문의 리듬은 살립니다.`,
      guidance: [
        "문장 골조는 남기고 업무 맥락의 명사와 숫자만 바꿔보세요.",
        "톤을 완전히 바꾸기보다 원문의 전달감을 최대한 유지하세요.",
        takeawayHint,
      ],
    },
    {
      session_id: input.sessionId,
      mode: "role-play",
      title: "상황 응답",
      prompt_text: `${scenario} 상황에서 답한다고 생각하고, 교과서 말투보다 실무 말투에 가까운 짧은 답변을 써보세요.`,
      guidance: [
        "첫 문장에서 핵심부터 말하세요.",
        "이유나 숫자 한 가지로 바로 뒷받침하세요.",
        "마지막은 영향이나 다음 행동으로 마무리하세요.",
      ],
    },
    {
      session_id: input.sessionId,
      mode: "my-briefing",
      title: "내 브리핑 만들기",
      prompt_text: `${userLabel}가 ${roleLabel}로서 실제 업무 업데이트를 공유한다고 생각하고, 세션 패턴을 빌려 짧은 브리핑을 써보세요.`,
      guidance: [
        "2~4문장 안에서 끝내세요.",
        "예문처럼 쓰기보다 실제 내부 공유처럼 들리게 써보세요.",
        input.context?.expected_takeaway ??
          "듣는 사람에게 왜 중요한지 드러내세요.",
      ],
    },
  ];
}

export function buildPracticeDraft(
  mode: PracticeMode,
  sourceSentence: string,
  prompt?: PracticePrompt,
): string {
  if (mode === "slot-in") {
    return buildSlotTemplate(sourceSentence);
  }

  if (mode === "role-play") {
    return "핵심: \n이유: \n다음 액션: ";
  }

  return prompt?.prompt_text
    ? `${prompt.prompt_text}\n\n내 브리핑: `
    : "내 브리핑: ";
}

export function generateRewriteCoaching(params: {
  sourceSentence: string;
  rewrite: string;
  mode: PracticeMode;
}): PracticeCoachingSummary {
  const sourceWords = tokenize(params.sourceSentence);
  const rewriteWords = tokenize(params.rewrite);
  const overlap = sourceWords.filter((word) => rewriteWords.includes(word));
  const overlapRatio = sourceWords.length
    ? overlap.length / sourceWords.length
    : 0;
  const isShort = params.rewrite.trim().length < 40;

  const clarityFeedback = isShort
    ? "핵심은 보이지만 문장이 짧아서 판단 근거가 충분히 드러나지 않습니다."
    : "메시지 흐름은 읽히고 있습니다. 한 문장 안에서 핵심과 이유를 더 분리하면 더 선명해집니다.";
  const usefulnessFeedback =
    overlapRatio >= 0.25
      ? "원문의 구조를 꽤 잘 유지해서 실전에서 바로 재사용하기 좋습니다."
      : "의도는 맞지만 원문 패턴과의 연결이 약합니다. 표현 골조를 조금 더 남겨두는 편이 좋습니다.";

  return {
    summary: `${PRACTICE_MODE_LABELS[params.mode]}으로 업무 말하기 패턴을 자기 문장으로 옮기고 있습니다.`,
    clarity_feedback: clarityFeedback,
    usefulness_feedback: usefulnessFeedback,
    next_step:
      params.mode === "slot-in"
        ? "원문에서 남길 표현 1개와 바꿀 표현 2개를 다시 구분해 보세요."
        : "답변의 첫 문장을 더 짧게 만들고, 마지막 문장에 영향이나 다음 행동을 추가해 보세요.",
  };
}

export function generateVoiceCoachingSummary(params: {
  score: number;
  feedback: string;
}): PracticeCoachingSummary {
  return {
    summary: `음성 시도의 전달력 점수는 ${params.score}점입니다.`,
    clarity_feedback:
      params.score >= 80
        ? "핵심 문장은 잘 들립니다. 문장 첫머리의 리듬만 더 안정화하면 됩니다."
        : "발화는 전달되지만 문장 첫머리와 핵심 단어를 더 또렷하게 눌러줄 필요가 있습니다.",
    usefulness_feedback:
      "실전용 코칭은 '핵심 단어를 먼저 세우고 숫자/근거를 뒤에 붙이는 리듬'에 집중하는 편이 좋습니다.",
    pronunciation_feedback: params.feedback,
    next_step:
      "같은 문장을 한 번 더 녹음하되 첫 문장만 천천히 시작하고, 핵심 단어에서 강세를 의식해 보세요.",
    score: params.score,
  };
}

export function getNextMasteryStatus(
  current: PlaybookMasteryStatus,
): PlaybookMasteryStatus {
  if (current === "new") return "practicing";
  if (current === "practicing") return "mastered";
  return "new";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
