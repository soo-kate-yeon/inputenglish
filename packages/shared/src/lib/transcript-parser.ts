import { TranscriptItem, Sentence } from "../types/index";
export type { TranscriptItem, Sentence };

function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. Hermes)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parse transcript items and merge them into sentences
 * Sentences are split by:
 * 1. Primary punctuation (. ! ?)
 * 2. Secondary punctuation (, ; :)
 * 3. Maximum length (150 characters)
 * 4. Time gaps (2+ seconds)
 * 5. Word count (15+ words)
 */
export function parseTranscriptToSentences(
  transcriptItems: TranscriptItem[],
): Sentence[] {
  // If first item has no timestamp (e.g. from raw text), use raw text parser
  if (
    transcriptItems.length > 0 &&
    typeof transcriptItems[0].start !== "number"
  ) {
    // @ts-ignore - Handle raw text masquerading as TranscriptItem
    return parseRawTextToSentences(
      transcriptItems.map((i) => i.text).join(" "),
    );
  }

  const expandedItems = transcriptItems.flatMap((item) =>
    splitTranscriptItemByPrimaryPunctuation(item),
  );

  const sentences: Sentence[] = [];
  let currentSentence = "";
  let currentStartTime = 0;
  let currentEndTime = 0;
  let lastItemEndTime = 0;

  // Configuration
  const MAX_SENTENCE_LENGTH = 300; // characters (Increased 2x)
  const MAX_WORD_COUNT = 40; // words (Increased to match longer sentences)
  const TIME_GAP_THRESHOLD = 2.0; // seconds

  const createSentence = (reason: string, index: number) => {
    if (currentSentence.trim()) {
      sentences.push({
        id: generateId(),
        text: currentSentence.trim(),
        startTime: currentStartTime,
        endTime: currentEndTime,
        highlights: [],
      });

      currentSentence = "";
    }
  };

  expandedItems.forEach((item, index) => {
    // Skip items with no text
    if (!item.text) return;

    // Initialize start time for new sentence
    if (currentSentence === "") {
      currentStartTime = item.start;
    }

    // Check for time gap (indicates natural pause/break)
    const timeGap = lastItemEndTime > 0 ? item.start - lastItemEndTime : 0;
    if (timeGap >= TIME_GAP_THRESHOLD && currentSentence !== "") {
      createSentence("time gap", index);
      currentStartTime = item.start;
    }

    // Add current item to sentence
    currentSentence += (currentSentence ? " " : "") + item.text;
    currentEndTime = item.start + item.duration;
    lastItemEndTime = currentEndTime;

    // Check various sentence-ending conditions
    const text = item.text.trim();
    const primaryPunctuation = /[.!?]$/.test(text);
    // Secondary punctuation check removed as requested
    const isLastItem = index === expandedItems.length - 1;
    const currentLength = currentSentence.trim().length;
    const currentWordCount = currentSentence.trim().split(/\s+/).length;

    // Decision tree for sentence breaks
    if (primaryPunctuation) {
      // Always break on . ! ?
      createSentence("primary punctuation", index);
    } else if (currentLength >= MAX_SENTENCE_LENGTH) {
      // Force break if too long
      createSentence("max length", index);
    } else if (currentWordCount >= MAX_WORD_COUNT) {
      // Force break if too many words
      createSentence("max words", index);
    } else if (isLastItem) {
      // Always create sentence for last item
      createSentence("last item", index);
    }
  });

  return sentences;
}

function splitTranscriptItemByPrimaryPunctuation(
  item: TranscriptItem,
): TranscriptItem[] {
  const text = item.text?.trim();

  if (!text) {
    return [];
  }

  const fragments = text
    .split(/(?<=[.!?])\s+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);

  if (fragments.length <= 1) {
    return [{ ...item, text }];
  }

  const totalLength = fragments.reduce(
    (sum, fragment) => sum + fragment.length,
    0,
  );
  let consumedDuration = 0;

  return fragments.map((fragment, index) => {
    const remainingDuration = Math.max(item.duration - consumedDuration, 0);
    const fragmentDuration =
      index === fragments.length - 1
        ? remainingDuration
        : totalLength > 0
          ? (item.duration * fragment.length) / totalLength
          : item.duration / fragments.length;

    const fragmentStart = item.start + consumedDuration;
    consumedDuration += fragmentDuration;

    return {
      ...item,
      text: fragment,
      start: fragmentStart,
      duration: fragmentDuration,
    };
  });
}

function sanitizeYouTubeInput(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .trim();
}

/**
 * Extract YouTube video ID from URL
 */
export function extractVideoId(url: string): string | null {
  const trimmed = sanitizeYouTubeInput(url);
  if (!trimmed) return null;

  // Accept a bare 11-char YouTube id directly.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    ) {
      const queryId =
        parsed.searchParams.get("v") || parsed.searchParams.get("vi");
      if (queryId && /^[a-zA-Z0-9_-]{11}$/.test(queryId)) {
        return queryId;
      }

      const segments = parsed.pathname.split("/").filter(Boolean);
      const pathId = segments.find((segment, index) => {
        const prev = segments[index - 1];
        return (
          /^[a-zA-Z0-9_-]{11}$/.test(segment) &&
          ["embed", "shorts", "live", "v"].includes(prev ?? "")
        );
      });

      if (pathId) {
        return pathId;
      }
    }

    if (hostname === "youtu.be") {
      const pathId = parsed.pathname.split("/").filter(Boolean)[0];
      if (pathId && /^[a-zA-Z0-9_-]{11}$/.test(pathId)) {
        return pathId;
      }
    }
  } catch {
    // Fall through to regex matching below.
  }

  const patterns = [
    /(?:youtube\.com\/watch\?.*?[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = candidate.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Normalize user-provided YouTube input into a canonical share URL when possible.
 */
export function normalizeYouTubeUrl(url: string): string {
  const sanitized = sanitizeYouTubeInput(url);
  const videoId = extractVideoId(sanitized);

  return videoId ? `https://youtu.be/${videoId}` : sanitized;
}

/**
 * Group sentences based on mode
 * - sentence: individual sentences (no grouping)
 * - paragraph: 5-10 sentences, must end with period
 * - total: all sentences combined into one
 */
export function groupSentencesByMode(
  sentences: Sentence[],
  mode: "sentence" | "paragraph" | "total",
): Sentence[] {
  if (mode === "sentence") {
    return sentences;
  }

  if (mode === "total") {
    // Combine all sentences into one
    if (sentences.length === 0) return [];

    return [
      {
        id: generateId(),
        text: sentences.map((s) => s.text).join(" "),
        startTime: sentences[0].startTime,
        endTime: sentences[sentences.length - 1].endTime,
        highlights: [],
      },
    ];
  }

  // Paragraph mode: 5-10 sentences, must end with period
  const paragraphs: Sentence[] = [];
  let currentParagraph: Sentence[] = [];

  sentences.forEach((sentence, index) => {
    currentParagraph.push(sentence);

    const endsWithPeriod = sentence.text.trim().endsWith(".");
    const hasMinSentences = currentParagraph.length >= 5;
    const hasMaxSentences = currentParagraph.length >= 10;
    const isLastSentence = index === sentences.length - 1;

    // Create paragraph if:
    // 1. Has 5-10 sentences AND ends with period
    // 2. Has 10 sentences (force break)
    // 3. Is last sentence and has at least 1 sentence
    if (
      (hasMinSentences && endsWithPeriod) ||
      hasMaxSentences ||
      isLastSentence
    ) {
      paragraphs.push({
        id: generateId(),
        text: currentParagraph.map((s) => s.text).join(" "),
        startTime: currentParagraph[0].startTime,
        endTime: currentParagraph[currentParagraph.length - 1].endTime,
        highlights: [],
      });
      currentParagraph = [];
    }
  });

  return paragraphs;
}

/**
 * Parse raw text into meaningful sentences for manual syncing
 * Handles newlines as potential breaks, but prioritizes punctuation
 */
export function parseRawTextToSentences(rawText: string): Sentence[] {
  if (!rawText) return [];

  // 1. Normalize line endings and remove extra spaces
  const normalized = rawText.replace(/\r\n/g, "\n").trim();

  // 2. Split by double newlines (paragraphs) first, then single newlines
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sentences: Sentence[] = [];

  // 3. Process each line
  lines.forEach((line) => {
    // Simple regex to split by .!? followed by space or end of string
    // But keep the punctuation
    const splitPattern = /([.!?]+)(?=\s|$)/g;

    let match;
    let lastIndex = 0;

    // Find all punctuation
    while ((match = splitPattern.exec(line)) !== null) {
      const endIndex = match.index + match[0].length;
      const text = line.substring(lastIndex, endIndex).trim();

      if (text) {
        sentences.push({
          id: generateId(),
          text,
          startTime: 0, // To be filled by Sync Editor
          endTime: 0,
          highlights: [],
        });
      }
      lastIndex = endIndex;
    }

    // Add remaining text if any
    const remaining = line.substring(lastIndex).trim();
    if (remaining) {
      sentences.push({
        id: generateId(),
        text: remaining,
        startTime: 0,
        endTime: 0,
        highlights: [],
      });
    }
  });

  return sentences;
}
