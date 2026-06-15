// @MX:NOTE: [AUTO] Difficulty scorer for SPEC-INPUT-001 Listening Track video segments.
// @MX:SPEC: SPEC-INPUT-001 - Phase 3, Task 3.3 / 3.4
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TranscriptLine } from "@inputenglish/shared";

const GEMINI_MODEL_SELF_CONTAINED =
  process.env.GEMINI_MODEL_SELF_CONTAINED ?? "gemini-2.5-flash";

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
 * @MX:NOTE: [AUTO] Heuristic v1 is the default. LLM upgrade is now wired via
 * isSelfContainedLLM() gated by SEGMENT_SELF_CONTAINED_LLM=true env var.
 * The @MX:TODO has been resolved: call isSelfContainedLLM when env is set;
 * fall back to this regex heuristic on LLM error or when env is unset.
 * @MX:SPEC: SPEC-INPUT-002 - Phase 1, Task 1.4 (EC-001-B)
 */
export async function isSelfContained(transcript: string): Promise<boolean> {
  // Optional Gemini LLM path gated by env var
  if (process.env.SEGMENT_SELF_CONTAINED_LLM === "true") {
    try {
      return await isSelfContainedLLM(transcript);
    } catch (err) {
      console.warn(
        "[segment-scorer] isSelfContainedLLM failed, falling back to heuristic:",
        err,
      );
    }
  }
  return isSelfContainedHeuristic(transcript);
}

/**
 * Regex heuristic: checks for dangling references in the opening ~200 characters.
 * Returns false when the opener contains pronouns implying an external referent.
 */
export function isSelfContainedHeuristic(transcript: string): boolean {
  const opener = transcript.slice(0, 200).toLowerCase();
  const danglingRefs =
    /\b(that one|this one|as i mentioned|as we saw|earlier|previously|the former|the latter)\b/;
  return !danglingRefs.test(opener);
}

/**
 * LLM-based self-contained judgment using Gemini.
 * Activated when SEGMENT_SELF_CONTAINED_LLM=true.
 * Falls back to heuristic on error (called by isSelfContained).
 *
 * @MX:NOTE: [AUTO] Requires GEMINI_API_KEY. Uses brief prompt to keep cost low.
 * Response is interpreted as boolean (true/false JSON).
 */
export async function isSelfContainedLLM(transcript: string): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    // No key — fall through to heuristic caller
    throw new Error("GEMINI_API_KEY not set for isSelfContainedLLM");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL_SELF_CONTAINED,
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `
Does the following transcript segment stand alone without requiring context from a previous segment?
Answer only with JSON: {"self_contained": true} or {"self_contained": false}.

Transcript:
${transcript.slice(0, 500)}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { self_contained?: boolean };
    return parsed.self_contained === true;
  } catch {
    throw new Error(`isSelfContainedLLM: invalid JSON response: ${text}`);
  }
}
