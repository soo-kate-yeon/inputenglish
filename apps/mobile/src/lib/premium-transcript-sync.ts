import type { PremiumTranscriptLine } from "@inputenglish/shared";

export function findPremiumActiveTranscriptLine(
  lines: PremiumTranscriptLine[],
  currentTime: number,
): PremiumTranscriptLine | null {
  return (
    lines.find(
      (line) => currentTime >= line.startTime && currentTime <= line.endTime,
    ) ?? null
  );
}

export function getPremiumTranscriptScrollIndex(
  lines: PremiumTranscriptLine[],
  activeLineId: string | null | undefined,
): number {
  if (!activeLineId) return 0;
  const index = lines.findIndex((line) => line.id === activeLineId);
  return index >= 0 ? index : 0;
}

export const PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS = 100;
