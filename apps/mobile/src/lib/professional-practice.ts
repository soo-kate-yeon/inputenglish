import type {
  PlaybookMasteryStatus,
  PracticeCoachingSummary,
  PracticeMode,
  PracticePrompt,
  SessionContext,
  SessionRoleRelevance,
  SessionSpeakingFunction,
} from "@shadowoo/shared";

interface DefaultPracticePromptInput {
  sessionId: string;
  title: string;
  description?: string;
  speakingFunction?: SessionSpeakingFunction;
  roleRelevance?: SessionRoleRelevance[];
  context?: SessionContext | null;
  userDisplayName?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  engineer: "engineer",
  pm: "PM",
  designer: "designer",
  founder: "founder",
  marketer: "marketer",
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
    "a short professional update";
  const userLabel = input.userDisplayName?.trim()
    ? input.userDisplayName.trim()
    : "you";
  const roleLabel = input.roleRelevance?.[0]
    ? ROLE_LABELS[input.roleRelevance[0]]
    : "professional";
  const strategicIntent =
    input.context?.strategic_intent ??
    "Keep the message concrete, calm, and useful.";

  return [
    {
      session_id: input.sessionId,
      mode: "slot-in",
      title: "Pattern Slot-in",
      prompt_text: `Reuse the sentence pattern while swapping the business details. Focus on ${input.speakingFunction ?? "clear explanation"} and keep the original cadence intact.`,
      guidance: [
        "Keep the sentence skeleton but replace the business-specific nouns and numbers.",
        "Avoid changing the tone completely; stay close to the original delivery.",
        strategicIntent,
      ],
    },
    {
      session_id: input.sessionId,
      mode: "role-play",
      title: "Role-Play Response",
      prompt_text: `Imagine you are responding in ${scenario}. Give a concise answer that sounds ready for work, not for class.`,
      guidance: [
        "Open with the main point in one sentence.",
        "Support it with one concrete reason or data point.",
        "Close with the implication or next move.",
      ],
    },
    {
      session_id: input.sessionId,
      mode: "my-briefing",
      title: "My Briefing",
      prompt_text: `Write a short briefing for ${userLabel} as a ${roleLabel}. Use the session pattern to explain one real update from your work.`,
      guidance: [
        "Keep it to 2-4 sentences.",
        "Sound like an actual internal update, not a textbook example.",
        input.context?.expected_takeaway ??
          "Show why the message matters to the listener.",
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
    return `Main point: \nReason: \nNext move: `;
  }

  return prompt?.prompt_text
    ? `${prompt.prompt_text}\n\nMy briefing: `
    : "My briefing: ";
}

export function generateRewriteCoaching(params: {
  sourceSentence: string;
  rewrite: string;
  mode: PracticeMode;
  speakingFunction?: SessionSpeakingFunction;
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
    summary: `${params.mode} 연습으로 ${params.speakingFunction ?? "professional speaking"} 패턴을 자기 문장으로 옮기고 있습니다.`,
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
