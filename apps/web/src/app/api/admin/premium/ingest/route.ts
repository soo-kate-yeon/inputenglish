// @MX:NOTE: [AUTO] Admin-only ingest endpoint for SPEC-INPUT-001 Listening Track.
// @MX:SPEC: SPEC-INPUT-001 - Phase 3, Task 3.2 / 3.5
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { loadTranscriptWithYtDlp } from "@/lib/premium/youtube-transcript";
import {
  calculateWpm,
  scoreSegmentDifficulty,
  isSelfContained,
} from "@/lib/premium/segment-scorer";
import type { TranscriptLine } from "@inputenglish/shared";

// Segment duration window in seconds (configurable via env)
const SEGMENT_MIN_SECONDS = Number(process.env.SEGMENT_MIN_SECONDS ?? 60);
const SEGMENT_MAX_SECONDS = Number(process.env.SEGMENT_MAX_SECONDS ?? 120);

const ingestRequestSchema = z.object({
  videoId: z.string().min(1),
  channelId: z.string().uuid(),
});

/**
 * Split a flat array of PremiumTranscriptLines into variable-length windows
 * of SEGMENT_MIN_SECONDS to SEGMENT_MAX_SECONDS each.
 * Returns groups of TranscriptLine (the shared type used by segment-scorer).
 */
function splitIntoSegments(
  lines: Array<{
    id: string;
    text: string;
    startTime: number;
    endTime: number;
  }>,
): TranscriptLine[][] {
  const segments: TranscriptLine[][] = [];
  let current: TranscriptLine[] = [];
  let windowStart: number | null = null;

  for (const line of lines) {
    const tl: TranscriptLine = {
      start: line.startTime,
      end: line.endTime,
      text: line.text,
    };
    if (windowStart === null) {
      windowStart = line.startTime;
    }
    current.push(tl);
    const elapsed = line.endTime - windowStart;
    if (elapsed >= SEGMENT_MIN_SECONDS) {
      segments.push(current);
      current = [];
      windowStart = null;
    }
  }

  // Flush the last partial segment if it has content and exceeds a minimum threshold
  if (current.length > 0) {
    const lastDuration = current[current.length - 1].end - current[0].start;
    if (lastDuration >= SEGMENT_MIN_SECONDS / 2) {
      segments.push(current);
    }
  }

  return segments;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid ingest payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { videoId, channelId } = parsed.data;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const { transcript } = await loadTranscriptWithYtDlp(sourceUrl);

    const segmentGroups = splitIntoSegments(transcript);

    const supabase = createAdminClient();
    const inserted: string[] = [];

    for (const lines of segmentGroups) {
      if (lines.length === 0) continue;

      const wpm = calculateWpm(lines);
      const transcriptText = lines.map((l) => l.text).join(" ");

      // v1: unknown ratio defaults to 0 — full LLM vocab coverage deferred to Phase 4
      const unknownRatio = 0;
      const difficultyScore = scoreSegmentDifficulty(wpm, unknownRatio);
      const selfContained = await isSelfContained(transcriptText);

      const { data, error } = await supabase
        .from("video_segments")
        .insert({
          parent_video_id: videoId,
          channel_id: channelId,
          start_time: lines[0].start,
          end_time: lines[lines.length - 1].end,
          transcript: lines,
          wpm,
          band_coverage: {},
          topic_tags: [],
          self_contained: selfContained,
          difficulty_score: difficultyScore,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[admin/premium/ingest] segment insert failed", error);
        continue;
      }

      if (data?.id) inserted.push(data.id);
    }

    return NextResponse.json({ inserted, count: inserted.length });
  } catch (error) {
    console.error("[admin/premium/ingest] failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ingest failed",
      },
      { status: 422 },
    );
  }
}
