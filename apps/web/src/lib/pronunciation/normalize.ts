import type {
  PronunciationFeedback,
  PronunciationWordIssue,
} from "@inputenglish/shared";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function pickPrimaryResult(payload: JsonRecord): JsonRecord {
  const nbest = asArray(payload.NBest);
  return asRecord(nbest[0]) ?? payload;
}

function getPronunciationAssessment(container: JsonRecord): JsonRecord {
  return asRecord(container.PronunciationAssessment) ?? {};
}

function toWordIssues(words: unknown[]): PronunciationWordIssue[] {
  return words
    .map((word) => asRecord(word))
    .filter((word): word is JsonRecord => Boolean(word))
    .map((word) => {
      const assessment = getPronunciationAssessment(word);
      return {
        word: asString(word.Word) ?? asString(word.Display) ?? "unknown",
        error_type: asString(word.ErrorType),
        accuracy_score: asNumber(assessment.AccuracyScore),
      };
    });
}

function buildSummary(params: {
  recognizedText: string | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  prosodyScore: number | null;
}): string {
  if (!params.recognizedText) {
    return "문장을 따라 말하려는 시도는 있었지만, 인식된 문장이 충분하지 않아 전달력이 낮게 잡혔어요.";
  }

  if ((params.prosodyScore ?? 0) >= 80 && (params.fluencyScore ?? 0) >= 80) {
    return "전체 전달감은 꽤 자연스러워요. 이제 핵심 단어를 더 분명히 눌러주면 훨씬 좋아져요.";
  }

  if ((params.fluencyScore ?? 0) < 65) {
    return "단어 자체보다 문장 리듬이 먼저 흔들렸어요. 속도와 끊어읽기를 먼저 정리하는 편이 좋아요.";
  }

  if ((params.accuracyScore ?? 0) < 70) {
    return "핵심 단어 몇 개가 흐려져서 문장 전달력이 덜 살아났어요. 발음 선명도를 먼저 올려볼 만해요.";
  }

  return "문장의 뼈대는 잘 따라갔어요. 이제 억양과 강세를 조금만 더 다듬으면 자연스러움이 올라가요.";
}

function selectTopWordIssue(
  wordIssues: PronunciationWordIssue[],
): PronunciationWordIssue | null {
  const scored = wordIssues
    .filter((issue) => issue.accuracy_score != null)
    .sort((a, b) => (a.accuracy_score ?? 100) - (b.accuracy_score ?? 100));

  return scored[0] ?? wordIssues[0] ?? null;
}

export function normalizeAzurePronunciationResult(params: {
  payload: JsonRecord;
  referenceText: string;
  providerLocale: string;
}): PronunciationFeedback {
  const primary = pickPrimaryResult(params.payload);
  const assessment = getPronunciationAssessment(primary);
  const words = asArray(primary.Words);
  const wordIssues = toWordIssues(words);
  const topWordIssue = selectTopWordIssue(wordIssues);

  const accuracyScore = asNumber(assessment.AccuracyScore);
  const fluencyScore = asNumber(assessment.FluencyScore);
  const completenessScore = asNumber(assessment.CompletenessScore);
  const prosodyScore = asNumber(assessment.ProsodyScore);

  const notes: Array<{
    key:
      | "pacing_note"
      | "chunking_note"
      | "stress_note"
      | "ending_tone_note"
      | "clarity_note";
    text: string;
    priority: number;
  }> = [];

  if ((fluencyScore ?? 100) < 65) {
    notes.push({
      key: "pacing_note",
      text: "조금 급하거나 끊기는 지점이 있어서, 첫 3~4단어를 더 천천히 붙여 읽는 연습이 먼저 좋아요.",
      priority: 1,
    });
    notes.push({
      key: "chunking_note",
      text: "문장을 단어별로 끊기보다 의미 단위로 묶어 읽으면 훨씬 자연스럽게 들려요.",
      priority: 2,
    });
  }

  if ((prosodyScore ?? 100) < 70) {
    notes.push({
      key: "stress_note",
      text: "강세가 전반적으로 평평하게 들려요. 핵심 단어 한두 개만 의식해서 눌러도 문장 힘이 살아나요.",
      priority: 1,
    });
  }

  if (topWordIssue && (topWordIssue.accuracy_score ?? 100) < 75) {
    notes.push({
      key: "clarity_note",
      text: `'${topWordIssue.word}' 쪽 발음이 특히 흐렸어요. 그 단어만 따로 또렷하게 빼서 한 번 더 말해보면 좋아요.`,
      priority: 1,
    });
  }

  if (
    (prosodyScore ?? 100) >= 70 &&
    (fluencyScore ?? 100) >= 70 &&
    (accuracyScore ?? 100) >= 70
  ) {
    notes.push({
      key: "ending_tone_note",
      text: "문장 끝을 너무 세게 끊지 말고, 마지막 어절을 살짝 이어주듯 마무리하면 더 자연스럽게 들려요.",
      priority: 3,
    });
  }

  const selectedNotes = notes
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
  const noteMap: Partial<
    Pick<
      PronunciationFeedback,
      | "pacing_note"
      | "chunking_note"
      | "stress_note"
      | "ending_tone_note"
      | "clarity_note"
    >
  > = {};
  for (const note of selectedNotes) {
    noteMap[note.key] = note.text;
  }

  let nextFocus = "문장 첫머리 리듬";
  if ((prosodyScore ?? 100) < 70) {
    nextFocus = "핵심 단어 강세";
  } else if ((fluencyScore ?? 100) < 65) {
    nextFocus = "의미 단위 끊어읽기";
  } else if (topWordIssue && (topWordIssue.accuracy_score ?? 100) < 75) {
    nextFocus = `'${topWordIssue.word}' 발음 선명도`;
  }

  const scoreValues = [
    accuracyScore,
    fluencyScore,
    completenessScore,
    prosodyScore,
  ].filter((value): value is number => value != null);
  const overallScore =
    scoreValues.length > 0
      ? Number(
          (
            scoreValues.reduce((sum, value) => sum + value, 0) /
            scoreValues.length
          ).toFixed(2),
        )
      : null;

  return {
    status: "complete",
    provider: "azure",
    reference_text: params.referenceText,
    recognized_text:
      asString(primary.Display) ?? asString(primary.Lexical) ?? null,
    overall_score: overallScore,
    accuracy_score: accuracyScore,
    fluency_score: fluencyScore,
    completeness_score: completenessScore,
    prosody_score: prosodyScore,
    summary: buildSummary({
      recognizedText: asString(primary.Display) ?? null,
      accuracyScore,
      fluencyScore,
      prosodyScore,
    }),
    pacing_note: noteMap.pacing_note ?? null,
    chunking_note: noteMap.chunking_note ?? null,
    stress_note: noteMap.stress_note ?? null,
    ending_tone_note: noteMap.ending_tone_note ?? null,
    clarity_note: noteMap.clarity_note ?? null,
    next_focus: nextFocus,
    confidence:
      scoreValues.length > 0
        ? Number(
            Math.min(
              0.95,
              Math.max(
                0.35,
                scoreValues.length / 4 - wordIssues.length * 0.02 + 0.35,
              ),
            ).toFixed(2),
          )
        : 0.35,
    word_issues: wordIssues.slice(0, 5),
  };
}
