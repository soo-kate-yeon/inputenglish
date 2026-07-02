// @MX:NOTE: [AUTO] Web transcript-to-playback-time sync (Task 5.3, REQ-WEB-004-E1).
//   Re-implements the synchronization PATTERN from
//   apps/mobile/src/lib/premium-transcript-sync.ts for a web iframe player
//   context — operates on VideoSegment's TranscriptLine[] shape
//   ({ start, end, text }) rather than mobile's PremiumTranscriptLine
//   ({ id, startTime, endTime }), since Phase 5's RWL step syncs against
//   video_segments.transcript, not the mobile premium-session transcript.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.3 (REQ-WEB-004-E1, D1)
import type { TranscriptLine } from "@inputenglish/shared";

/**
 * Finds the transcript line whose [start, end] window contains currentTime
 * (YouTube iframe player currentTime, in seconds).
 */
export function findActiveTranscriptLine(
  lines: TranscriptLine[],
  currentTime: number,
): TranscriptLine | null {
  return (
    lines.find(
      (line) => currentTime >= line.start && currentTime <= line.end,
    ) ?? null
  );
}

/**
 * Returns the scroll index of the active transcript line so the RWL
 * transcript panel can auto-scroll to keep it in view. Matches by identity
 * (start+end+text) since TranscriptLine has no stable id field.
 */
export function getTranscriptScrollIndex(
  lines: TranscriptLine[],
  activeLine: TranscriptLine | null,
): number {
  if (!activeLine) return 0;
  const index = lines.findIndex(
    (line) =>
      line.start === activeLine.start &&
      line.end === activeLine.end &&
      line.text === activeLine.text,
  );
  return index >= 0 ? index : 0;
}

/** Polling interval (ms) for reading iframe currentTime and re-syncing the transcript. */
export const TRANSCRIPT_SYNC_INTERVAL_MS = 100;
