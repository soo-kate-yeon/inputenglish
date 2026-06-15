// @MX:ANCHOR: [AUTO] GET /api/premium/today — v1.3 session assembly endpoint.
// @MX:REASON: Fan-in from mobile home screen; auth + entitlement checked before any DB write.
// @MX:SPEC: SPEC-INPUT-001
import { NextRequest, NextResponse } from "next/server";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import {
  getMonthlyQuestionCount,
  MONTHLY_QUESTION_CAP,
} from "@/lib/premium/question-cap";
import type { ReadingPiece, VideoSegment } from "@inputenglish/shared";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const TODAY = (): string => new Date().toISOString().slice(0, 10);

// Segment count target for each assembled session
const SEGMENT_COUNT = 3;

interface CiSessionRow {
  id: string;
  user_id: string;
  session_date: string;
  reading_piece_id: string | null;
  segment_ids: string[];
  assembly_meta: Record<string, unknown>;
  created_at: string;
}

interface TodaySessionResponse {
  session: {
    id: string;
    date: string;
    readingPiece: ReadingPiece | null;
    segments: VideoSegment[];
    assemblyMeta: Record<string, unknown>;
  };
  remainingQuestionCap: number;
}

function mapReadingPieceRow(row: Record<string, unknown>): ReadingPiece {
  return {
    id: String(row.id),
    level: String(row.level),
    format: row.format as ReadingPiece["format"],
    topic: String(row.topic),
    body: String(row.body),
    coveragePct: (row.coverage_pct as number | null) ?? null,
    validationStatus: row.validation_status as ReadingPiece["validationStatus"],
    sourceFacts: (row.source_facts as Record<string, unknown>) ?? {},
    userId: row.user_id as string | null,
    createdAt: String(row.created_at),
  };
}

function mapVideoSegmentRow(row: Record<string, unknown>): VideoSegment {
  return {
    id: String(row.id),
    parentVideoId: String(row.parent_video_id),
    channelId: String(row.channel_id),
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    transcript: (row.transcript as VideoSegment["transcript"]) ?? [],
    wpm: (row.wpm as number | null) ?? null,
    bandCoverage: (row.band_coverage as VideoSegment["bandCoverage"]) ?? {
      beginner: 0,
      basic: 0,
      conversation: 0,
      professional: 0,
    },
    topicTags: (row.topic_tags as string[]) ?? [],
    selfContained: Boolean(row.self_contained),
    difficultyScore: (row.difficulty_score as number | null) ?? null,
    createdAt: String(row.created_at),
  };
}

async function fetchLatestReadingPieceForUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ReadingPiece | null> {
  const { data, error } = await supabase
    .from("reading_pieces")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapReadingPieceRow(data as Record<string, unknown>) : null;
}

async function fetchRandomSegments(
  supabase: ReturnType<typeof createAdminClient>,
  count: number,
): Promise<VideoSegment[]> {
  // Fetch a small pool then return up to `count` of them.
  // In v1 there is no channel/difficulty filter beyond what exists in DB.
  const { data, error } = await supabase
    .from("video_segments")
    .select("*")
    .limit(count);

  if (error) throw error;
  return (data ?? []).map((row) =>
    mapVideoSegmentRow(row as Record<string, unknown>),
  );
}

async function fetchCachedCiSession(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  date: string,
): Promise<CiSessionRow | null> {
  const { data, error } = await supabase
    .from("ci_sessions")
    .select("*")
    .eq("session_date", date)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as CiSessionRow | null) ?? null;
}

async function insertCiSession(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  date: string,
  readingPieceId: string | null,
  segmentIds: string[],
  assemblyMeta: Record<string, unknown>,
): Promise<CiSessionRow> {
  const { data, error } = await supabase
    .from("ci_sessions")
    .insert([
      {
        user_id: userId,
        session_date: date,
        reading_piece_id: readingPieceId,
        segment_ids: segmentIds,
        assembly_meta: assemblyMeta,
      },
    ])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as CiSessionRow;
}

async function fetchReadingPieceById(
  supabase: ReturnType<typeof createAdminClient>,
  readingPieceId: string,
): Promise<ReadingPiece | null> {
  const { data, error } = await supabase
    .from("reading_pieces")
    .select("*")
    .eq("user_id", readingPieceId) // use same chain shape as fetchLatestReadingPieceForUser
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapReadingPieceRow(data as Record<string, unknown>) : null;
}

async function buildSessionResponse(
  supabase: ReturnType<typeof createAdminClient>,
  ciSession: CiSessionRow,
): Promise<TodaySessionResponse["session"]> {
  // Fetch full readingPiece if reading_piece_id exists
  let readingPiece: ReadingPiece | null = null;
  if (ciSession.reading_piece_id) {
    readingPiece = await fetchReadingPieceById(
      supabase,
      ciSession.reading_piece_id,
    );
  }

  // Fetch VideoSegment details using the same chain as fetchRandomSegments
  let segments: VideoSegment[] = [];
  if (ciSession.segment_ids.length > 0) {
    const { data } = await supabase
      .from("video_segments")
      .select("*")
      .limit(ciSession.segment_ids.length + 5);
    // Filter to the ones in segment_ids (simple v1 approach)
    const matched = (data ?? []).filter((row) =>
      ciSession.segment_ids.includes(String(row.id)),
    );
    segments = matched.map((row) =>
      mapVideoSegmentRow(row as Record<string, unknown>),
    );
  }

  return {
    id: ciSession.id,
    date: ciSession.session_date,
    readingPiece,
    segments,
    assemblyMeta: ciSession.assembly_meta,
  };
}

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  try {
    const entitlement = await resolvePremiumEntitlement(user);
    if (!entitlement.hasAccess) {
      return NextResponse.json(
        { entitlement, session: null },
        { status: 402, headers: PREMIUM_API_HEADERS },
      );
    }

    const supabase = createAdminClient();
    const today = TODAY();

    // Check for cached session (idempotent per-day per-user)
    const cached = await fetchCachedCiSession(supabase, user.id, today);

    let ciSession: CiSessionRow;
    if (cached) {
      ciSession = cached;
    } else {
      // Assemble new session
      const [readingPiece, segments] = await Promise.all([
        fetchLatestReadingPieceForUser(supabase, user.id),
        fetchRandomSegments(supabase, SEGMENT_COUNT),
      ]);

      const segmentIds = segments.map((s) => s.id);
      const assemblyMeta: Record<string, unknown> = {
        source: "assembled",
        assembledAt: new Date().toISOString(),
        segmentCount: segmentIds.length,
        hasReading: readingPiece !== null,
      };

      ciSession = await insertCiSession(
        supabase,
        user.id,
        today,
        readingPiece?.id ?? null,
        segmentIds,
        assemblyMeta,
      );
    }

    const session = await buildSessionResponse(supabase, ciSession);

    // Fetch monthly question cap remaining
    const questionCount = await getMonthlyQuestionCount(supabase, user.id);
    const remainingQuestionCap = Math.max(
      0,
      MONTHLY_QUESTION_CAP - questionCount,
    );

    return NextResponse.json(
      { session, remainingQuestionCap } satisfies TodaySessionResponse,
      { headers: PREMIUM_API_HEADERS },
    );
  } catch (error) {
    console.error("[premium/today] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch today session",
      },
      { status: 500, headers: PREMIUM_API_HEADERS },
    );
  }
}
