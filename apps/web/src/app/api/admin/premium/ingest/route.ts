// @MX:ANCHOR: [AUTO] Admin ingest entrypoint for SPEC-INPUT-001 Listening Track.
// @MX:REASON: Public API boundary with dual-auth gate (requireAdmin OR CRON_SECRET).
// Fan-in: direct admin calls + autonomous cron/agent triggers. Do NOT remove auth gate.
// @MX:SPEC: SPEC-INPUT-001 - Phase 3, Task 3.2 / 3.5 | SPEC-INPUT-002 - Phase 1
// @MX:NOTE: [AUTO] CRON_SECRET auth path: if x-cron-secret or Authorization: Bearer
// header matches process.env.CRON_SECRET, ingest proceeds without admin session.
// This enables autonomous agent / Vercel Cron triggers (REQ-AUTO-001-U3).
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
import { translateLines } from "@/lib/premium/translation";
import {
  computeBandCoverage,
  extractTopicTags,
} from "@/lib/premium/band-coverage";
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

/**
 * Verify the request is authorized:
 * 1. Try requireAdmin() — succeeds for admin sessions.
 * 2. If that returns a NextResponse (auth failure), check for valid CRON_SECRET.
 *    Accepted via x-cron-secret header OR Authorization: Bearer <secret>.
 *
 * Returns null if authorized, or a NextResponse error if not.
 */
async function checkAuthorization(
  request: NextRequest,
): Promise<NextResponse | null> {
  const adminResult = await requireAdmin();
  if (!(adminResult instanceof NextResponse)) {
    // Admin session is valid
    return null;
  }

  // Admin auth failed — try CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization");
    const bearerSecret = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (headerSecret === cronSecret || bearerSecret === cronSecret) {
      return null; // CRON_SECRET path authorized
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const authError = await checkAuthorization(request);
  if (authError) return authError;

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

      // @MX:NOTE: [AUTO] Per-segment try-continue: a single segment failure
      // (translation, score, or DB insert) must not abort the whole ingest.
      // REQ-AUTO-001-W1: partial success is allowed.
      try {
        const wpm = calculateWpm(lines);
        const transcriptText = lines.map((l) => l.text).join(" ");

        // --- Task 1.1: per-line Korean translation ---
        const lineTexts = lines.map((l) => l.text);
        let translations: string[];
        try {
          translations = await translateLines(lineTexts);
        } catch (err) {
          console.error(
            "[admin/premium/ingest] translation failed for segment",
            err,
          );
          // Fallback: empty strings (still non-crashing — EC-001-A)
          translations = lineTexts.map(() => "");
        }

        // Attach translation to each TranscriptLine
        const linesWithTranslation = lines.map((line, idx) => ({
          ...line,
          translation: translations[idx] ?? "",
        }));

        // --- Task 1.2: band_coverage computation ---
        const bandCoverage = computeBandCoverage(transcriptText);

        // --- Task 1.3: topic_tags computation ---
        const topicTags = extractTopicTags(transcriptText);

        // --- Derive unknownRatio from band_coverage for difficulty scoring ---
        // Use beginner band as proxy: unknownRatio = 1 - beginner coverage
        const unknownRatio = Math.max(0, 1 - (bandCoverage.beginner ?? 0));
        const difficultyScore = scoreSegmentDifficulty(wpm, unknownRatio);

        const selfContained = await isSelfContained(transcriptText);

        const { data, error } = await supabase
          .from("video_segments")
          .insert({
            parent_video_id: videoId,
            channel_id: channelId,
            start_time: lines[0].start,
            end_time: lines[lines.length - 1].end,
            transcript: linesWithTranslation,
            wpm,
            band_coverage: bandCoverage,
            topic_tags: topicTags,
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
      } catch (segErr) {
        // Isolation: log and continue (EC-001-A)
        console.error(
          "[admin/premium/ingest] segment processing failed",
          segErr,
        );
        continue;
      }
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
