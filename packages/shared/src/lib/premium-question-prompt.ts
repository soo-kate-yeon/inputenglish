// @MX:NOTE: [AUTO] Prompt builder + context extractors for the highlight question agent (POST /api/premium/question).
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-004

export const PREMIUM_QUESTION_PROMPT_VERSION = "v3" as const;

export interface BuildQuestionPromptInput {
  /** The word/phrase the user tapped in the reading or video segment. */
  highlightText: string;
  /** The user's follow-up question (defaults to a generic "what does this mean?" upstream). */
  question: string;
  /**
   * The surrounding source text where the highlight appears (the tapped sentence
   * plus a neighbor on each side). When present, the answer must be grounded in it.
   */
  context?: string;
}

export function buildQuestionPrompt(input: BuildQuestionPromptInput): string {
  const { highlightText, question, context } = input;

  const contextBlock = context?.trim()
    ? `\n문맥 (이 하이라이트가 등장한 원문):\n"""\n${context.trim()}\n"""\n`
    : "";

  return `역할: 너는 영어 학습앱 "인풋영어"의 친절한 원어민 튜터야. 학습자가 콘텐츠를 읽거나 보다가 모르는 단어/표현을 탭해서 물어본 상황이야.

하이라이트: '${highlightText}'
학습자 질문: "${question}"
${contextBlock}
답변 규칙:
- 반드시 한국어로, 다정하고 친근한 "~요" 체로 답해줘. 딱딱한 사전식·학술적 말투는 쓰지 마.
- 설명은 무조건 한국어로만 작성해. 절대 영어로 답하지 마. (예문이나 비교 표현에서 영어 문장·단어 자체를 인용하는 건 괜찮지만, 뜻풀이와 설명은 전부 한국어여야 해.)
- 문맥이 주어졌다면 반드시 그 문맥 속 의미로 설명해줘. 일반적인 사전 정의가 아니라 "여기서는 이런 뜻이에요"처럼 콕 집어서.
- 하이라이트가 단어 하나인지, 둘 이상으로 이뤄진 표현(구·관용구·콜로케이션)인지 먼저 판단해.
  - 단어이면: 이 문맥에서의 뜻과, 실제로 어떻게 쓰는지(용법)를 설명해줘.
  - 표현이면: 이 문맥에서의 뜻과, 말의 뉘앙스(어감·느낌·어떤 상황에서 쓰는지)를 설명해줘.
- 이해에 도움이 될 때만 짧은 예문 하나, 또는 비슷하거나 대조되는 표현을 덧붙여줘. 도움이 안 되면 억지로 넣지 마.
- 길게 늘어놓지 말고 핵심만. 보통 3~5문장이면 충분해. 학습자가 "아, 이런 거구나" 하고 바로 감 잡게.
- 군더더기 도입부("질문 주셨네요", "설명드릴게요" 등)나 메타 발화 없이 바로 본론으로.

출력은 아래 JSON만 반환해. 코드펜스나 다른 텍스트는 절대 붙이지 마.
{ "answer": "위 규칙대로 작성한 친절한 한국어 설명" }`;
}

export interface ExtractContextOptions {
  /** Neighboring sentences/lines to include on each side of the match. Default 1. */
  window?: number;
}

/**
 * Returns the sentence at `charOffset` plus `window` neighboring sentences on each
 * side, used to ground the question agent's answer in the reading body.
 *
 * Position-based (not search-based), so repeated words resolve to the exact sentence
 * the user tapped. `charOffset` is the offset of the tapped token within `fullText`.
 */
export function extractSentenceContext(
  fullText: string,
  charOffset: number,
  options: ExtractContextOptions = {},
): string | undefined {
  const text = typeof fullText === "string" ? fullText : "";
  if (!text.trim()) return undefined;

  // Tile the text into sentence ranges; each range keeps its trailing punctuation
  // and whitespace so the ranges cover every character and offsets stay exact.
  const boundary = /[.!?]+(?:\s+|$)/g;
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    ranges.push({ start: cursor, end });
    cursor = end;
  }
  if (cursor < text.length) ranges.push({ start: cursor, end: text.length });
  if (ranges.length === 0) return undefined;

  const window = Math.max(0, options.window ?? 1);
  const offset = Math.max(0, Math.min(charOffset, text.length - 1));
  let hit = ranges.findIndex((r) => offset >= r.start && offset < r.end);
  if (hit === -1) hit = ranges.length - 1;

  const start = Math.max(0, hit - window);
  const end = Math.min(ranges.length - 1, hit + window);
  return text.slice(ranges[start].start, ranges[end].end).trim() || undefined;
}

/**
 * Returns the transcript line at `lineIndex` plus `window` neighboring lines on each
 * side, joined into one string. Used to ground the answer in the tapped video caption.
 */
export function extractLineContext(
  lines: string[],
  lineIndex: number,
  options: ExtractContextOptions = {},
): string | undefined {
  if (!Array.isArray(lines) || lines.length === 0) return undefined;
  if (
    !Number.isInteger(lineIndex) ||
    lineIndex < 0 ||
    lineIndex >= lines.length
  ) {
    return undefined;
  }

  const window = Math.max(0, options.window ?? 1);
  const start = Math.max(0, lineIndex - window);
  const end = Math.min(lines.length - 1, lineIndex + window);
  return (
    lines
      .slice(start, end + 1)
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean)
      .join(" ") || undefined
  );
}
