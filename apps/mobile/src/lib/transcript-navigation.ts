import type { Sentence } from "@inputenglish/shared";

export type SentenceDirection = "prev" | "next";

export function resolveSentencesByIdsOrRange(
  transcript: Sentence[],
  sentenceIds?: string[] | null,
  startTime?: number | null,
  endTime?: number | null,
  fallbackCount = 8,
): Sentence[] {
  const normalizedIds = sentenceIds ?? [];

  if (normalizedIds.length > 0) {
    const mapped = normalizedIds
      .map((sentenceId) =>
        transcript.find((sentence) => sentence.id === sentenceId),
      )
      .filter((sentence): sentence is Sentence => Boolean(sentence));

    if (mapped.length > 0) {
      return mapped;
    }
  }

  const sessionStart = startTime ?? 0;
  const sessionEnd = endTime ?? Number.POSITIVE_INFINITY;
  const ranged = transcript.filter((sentence) => {
    return sentence.endTime >= sessionStart && sentence.startTime <= sessionEnd;
  });

  if (ranged.length > 0) {
    return ranged;
  }

  return transcript.slice(0, fallbackCount);
}

export function findSentenceIndex(
  sentences: Sentence[],
  sentenceId: string | null | undefined,
): number {
  if (!sentenceId) return -1;
  return sentences.findIndex((sentence) => sentence.id === sentenceId);
}

export function getAdjacentSentence(
  sentences: Sentence[],
  sentenceId: string | null | undefined,
  direction: SentenceDirection,
): Sentence | null {
  if (sentences.length === 0) return null;

  const currentIndex = findSentenceIndex(sentences, sentenceId);

  if (currentIndex < 0) {
    return direction === "next"
      ? (sentences[0] ?? null)
      : (sentences[sentences.length - 1] ?? null);
  }

  const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

  if (nextIndex < 0 || nextIndex >= sentences.length) {
    return null;
  }

  return sentences[nextIndex] ?? null;
}
