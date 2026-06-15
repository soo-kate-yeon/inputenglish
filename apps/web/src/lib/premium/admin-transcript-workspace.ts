import {
  extractVideoId,
  type PremiumTranscriptLine,
} from "@inputenglish/shared";
import { z } from "zod";
import { premiumTranscriptLineSchema } from "@/lib/premium/session-schema";

const transcriptLinesSchema = z.array(premiumTranscriptLineSchema);
const MIN_LINE_DURATION_SECONDS = 0.1;

function roundSeconds(value: number): number {
  return Number(value.toFixed(2));
}

function clampSeconds(value: number): number {
  return roundSeconds(Math.max(0, value));
}

export interface PremiumTranscriptParseResult {
  lines: PremiumTranscriptLine[];
  error: string | null;
}

export interface PremiumTranscriptStats {
  count: number;
  translatedCount: number;
  startTime: number | null;
  endTime: number | null;
  durationSeconds: number;
}

export interface PremiumTranscriptDraftAttachmentInput<
  TDraft extends Record<string, unknown>,
> {
  draft: TDraft;
  lines: PremiumTranscriptLine[];
  sourceUrl?: string | null;
  title?: string | null;
  durationSeconds?: number | null;
}

export function parsePremiumTranscriptJson(
  value: string,
): PremiumTranscriptParseResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { lines: [], error: null };
  }

  try {
    return {
      lines: transcriptLinesSchema.parse(JSON.parse(trimmed)),
      error: null,
    };
  } catch (error) {
    return {
      lines: [],
      error:
        error instanceof Error
          ? error.message
          : "Transcript JSON을 읽을 수 없어요.",
    };
  }
}

export function stringifyPremiumTranscript(
  lines: PremiumTranscriptLine[],
): string {
  return JSON.stringify(lines, null, 2);
}

export function normalizePremiumTranscriptLines(
  lines: PremiumTranscriptLine[],
): PremiumTranscriptLine[] {
  return transcriptLinesSchema.parse(
    lines.map((line, index) => {
      const startTime = clampSeconds(line.startTime);
      const endTime = clampSeconds(
        Math.max(line.endTime, startTime + MIN_LINE_DURATION_SECONDS),
      );

      return {
        ...line,
        id: line.id?.trim() || `premium-line-${index + 1}`,
        text: line.text.trim(),
        translation: line.translation?.trim() || undefined,
        startTime,
        endTime,
      };
    }),
  );
}

export function shiftPremiumTranscriptTiming(
  lines: PremiumTranscriptLine[],
  offsetSeconds: number,
): PremiumTranscriptLine[] {
  if (!Number.isFinite(offsetSeconds) || offsetSeconds === 0) {
    return normalizePremiumTranscriptLines(lines);
  }

  return normalizePremiumTranscriptLines(
    lines.map((line) => {
      const duration = Math.max(
        MIN_LINE_DURATION_SECONDS,
        line.endTime - line.startTime,
      );
      const startTime = clampSeconds(line.startTime + offsetSeconds);
      const unclampedEnd = line.endTime + offsetSeconds;
      const endTime =
        unclampedEnd <= startTime
          ? roundSeconds(startTime + duration)
          : clampSeconds(unclampedEnd);

      return {
        ...line,
        startTime,
        endTime,
      };
    }),
  );
}

export function updatePremiumTranscriptLine(
  lines: PremiumTranscriptLine[],
  lineId: string,
  patch: Partial<PremiumTranscriptLine>,
): PremiumTranscriptLine[] {
  return normalizePremiumTranscriptLines(
    lines.map((line) =>
      line.id === lineId
        ? {
            ...line,
            ...patch,
            text:
              typeof patch.text === "string" && !patch.text.trim()
                ? line.text
                : (patch.text ?? line.text),
          }
        : line,
    ),
  );
}

export function applyPremiumTranscriptTranslations(
  lines: PremiumTranscriptLine[],
  translations: string[],
): PremiumTranscriptLine[] {
  return normalizePremiumTranscriptLines(
    lines.map((line, index) => {
      const translation = translations[index]?.trim();
      return translation
        ? {
            ...line,
            translation,
          }
        : line;
    }),
  );
}

export function getPremiumTranscriptStats(
  lines: PremiumTranscriptLine[],
): PremiumTranscriptStats {
  if (!lines.length) {
    return {
      count: 0,
      translatedCount: 0,
      startTime: null,
      endTime: null,
      durationSeconds: 0,
    };
  }

  const startTime = Math.min(...lines.map((line) => line.startTime));
  const endTime = Math.max(...lines.map((line) => line.endTime));

  return {
    count: lines.length,
    translatedCount: lines.filter((line) => line.translation?.trim()).length,
    startTime,
    endTime,
    durationSeconds: Math.max(0, endTime - startTime),
  };
}

export function attachPremiumTranscriptToDraft<
  TDraft extends Record<string, unknown>,
>({
  draft,
  lines,
  sourceUrl,
  title,
  durationSeconds,
}: PremiumTranscriptDraftAttachmentInput<TDraft>): TDraft & {
  transcript: PremiumTranscriptLine[];
} {
  const normalizedLines = normalizePremiumTranscriptLines(lines);
  const transcriptStats = getPremiumTranscriptStats(normalizedLines);
  const trimmedSourceUrl = sourceUrl?.trim() || null;
  const trimmedTitle = title?.trim() || null;
  const videoId = trimmedSourceUrl ? extractVideoId(trimmedSourceUrl) : null;
  const nextDraft: Record<string, unknown> = {
    ...draft,
    transcript: normalizedLines,
  };

  if (trimmedSourceUrl) {
    nextDraft.source_url = trimmedSourceUrl;
  }
  if (videoId) {
    nextDraft.source_video_id = videoId;
    nextDraft.thumbnail_url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  if (trimmedTitle) {
    nextDraft.title = trimmedTitle;
  }
  if (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
  ) {
    nextDraft.duration_seconds = Math.ceil(durationSeconds);
  } else if (transcriptStats.endTime !== null) {
    nextDraft.duration_seconds = Math.ceil(transcriptStats.endTime);
  }
  if (transcriptStats.startTime !== null) {
    nextDraft.segment_start_time = transcriptStats.startTime;
  }
  if (transcriptStats.endTime !== null) {
    nextDraft.segment_end_time = transcriptStats.endTime;
  }

  return nextDraft as TDraft & { transcript: PremiumTranscriptLine[] };
}
