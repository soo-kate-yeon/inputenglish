// @MX:NOTE: [AUTO] Difficulty scorer for SPEC-INPUT-001 Listening Track video segments.
// @MX:SPEC: SPEC-INPUT-001 - Phase 3, Task 3.3 / 3.4
import type { TranscriptLine } from "@inputenglish/shared";

/**
 * Calculate words-per-minute from an array of TranscriptLine objects.
 * Uses the span from the first line's start to the last line's end for duration.
 */
export function calculateWpm(lines: TranscriptLine[]): number {
  if (lines.length === 0) return 0;
  const durationSeconds = lines[lines.length - 1].end - lines[0].start;
  if (durationSeconds <= 0) return 0;
  const wordCount = lines.reduce(
    (sum, l) => sum + l.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  return Math.round((wordCount / durationSeconds) * 60);
}

/**
 * Score a segment's difficulty on a 1-5 scale.
 * 1 = easiest (slow speech + high vocabulary coverage)
 * 5 = hardest (fast speech + many unknown words)
 *
 * @param wpm - Words per minute of the segment
 * @param unknownRatio - Fraction of words not in the user's known vocabulary (0-1)
 */
export function scoreSegmentDifficulty(
  wpm: number,
  unknownRatio: number,
): number {
  const wpmScore =
    wpm < 100 ? 1 : wpm < 120 ? 2 : wpm < 140 ? 3 : wpm < 160 ? 4 : 5;
  const coverageScore =
    unknownRatio > 0.1
      ? 5
      : unknownRatio > 0.05
        ? 4
        : unknownRatio > 0.02
          ? 3
          : unknownRatio > 0.01
            ? 2
            : 1;
  return Math.round((wpmScore + coverageScore) / 2);
}

/**
 * Heuristic v1: judge whether a transcript segment is self-contained.
 *
 * Checks for pronouns / demonstratives in the opening ~200 characters that
 * imply a referent established outside this segment (dangling references).
 *
 * @MX:TODO: Upgrade to Gemini LLM judgment in Phase 3 enhancement
 */
export async function isSelfContained(transcript: string): Promise<boolean> {
  const opener = transcript.slice(0, 200).toLowerCase();
  const danglingRefs =
    /\b(that one|this one|as i mentioned|as we saw|earlier|previously|the former|the latter)\b/;
  return !danglingRefs.test(opener);
}
