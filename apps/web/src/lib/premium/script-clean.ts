/**
 * @MX:NOTE: [AUTO] script_clean generator — builds a reading-ready clean
 *   transcript for the "reading = today's listening segment" model (D7, §0⑦).
 *   This is NOT a generated-reading pipeline; it is a minimal text cleanup
 *   over the already-ingested transcript (no LLM call), reusing the same
 *   per-line TranscriptLine shape as youtube-transcript.ts / segment-scorer.ts.
 *   Operates on a DIFFERENT concern than youtube-transcript.ts's
 *   cleanCaptionText(): that function strips HTML/VTT tags and entities at
 *   caption-parse time; this module strips bracketed non-speech notes and
 *   speaker-tag prefixes from already-parsed TranscriptLine.text (post-parse,
 *   reading-surface concern). Input here is assumed already HTML/entity-clean.
 * @MX:SPEC: SPEC-WEB-001 Phase 4 REQ-WEB-003-U2, D7, AC-003-1
 */
import type { TranscriptLine } from "@inputenglish/shared";

// Bracketed non-speech artifacts: [Music], [Applause], [00:01], [Laughter], etc.
const BRACKETED_ARTIFACT = /\[[^\]]*\]/g;
// Speaker-tag prefixes at the start of a line: "SPEAKER 1:", "HOST:", "JOHN SMITH:"
const SPEAKER_TAG_PREFIX = /^[A-Z][A-Z0-9 ]{0,30}:\s*/;

function cleanLineText(text: string): string {
  return text
    .replace(BRACKETED_ARTIFACT, "")
    .replace(SPEAKER_TAG_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a clean, reading-ready script from an array of transcript lines by
 * stripping timestamp/bracket artifacts and speaker-tag prefixes, then joining
 * with single spaces.
 *
 * Reused as `video_segments.script_clean` (REQ-WEB-003-U2) — the reading
 * surface for a day's session is this clean script, never a separately
 * generated reading piece (D7).
 */
export function buildScriptClean(lines: TranscriptLine[]): string {
  return lines
    .map((line) => cleanLineText(line.text))
    .filter((text) => text.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
