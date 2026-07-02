// @MX:ANCHOR: [AUTO] GET /api/premium/today — v1.3 band-aware session assembly endpoint.
// @MX:REASON: [AUTO] Fan-in from mobile home screen (high fan_in). Auth + entitlement checked
//   before any DB write. Pool reading replaces per-user reading as primary source (REQ-AUTO-003-U2).
//   Band resolution determines all pool queries (REQ-AUTO-003-U1). Preparing state prevents
//   empty session caching (REQ-AUTO-003-U3). ci_sessions UNIQUE cache ensures idempotency (U4).
// @MX:SPEC: SPEC-INPUT-002 - Phase 3 (REQ-AUTO-003 + REQ-AUTO-005 freeze)
import { NextRequest, NextResponse } from "next/server";
import { resolvePremiumEntitlement } from "@/lib/premium/entitlement";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import {
  getMonthlyQuestionCount,
  MONTHLY_QUESTION_CAP,
} from "@/lib/premium/question-cap";
import { clampToServableBand } from "@/lib/premium/reading-matrix";
import type {
  ReadingPiece,
  VideoSegment,
  VocabBand,
} from "@inputenglish/shared";

const PREMIUM_API_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const TODAY = (): string => new Date().toISOString().slice(0, 10);

// Segment count target for each assembled session
const SEGMENT_COUNT = 3;

// Ordered bands from easiest to hardest (index used for ±1 adjacency fallback)
const BAND_ORDER: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

// @MX:NOTE: [AUTO] LearningLevelBand has the same 4 values as VocabBand (1:1 map).
// level_band from the users (learning profile) table maps directly to VocabBand.
const LEVEL_BAND_TO_VOCAB_BAND: Record<string, VocabBand> = {
  beginner: "beginner",
  basic: "basic",
  conversation: "conversation",
  professional: "professional",
};

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
    // SPEC-INPUT-002 Phase 2: new pool columns
    band: (row.band as ReadingPiece["band"]) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
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

// @MX:ANCHOR: [AUTO] resolveUserBand — determines the VocabBand used for pool queries.
// @MX:REASON: [AUTO] Fan-in from all assembly paths (new session assembly). Band resolution
//   precedence: (1) user_vocab_profiles.estimated_band, (2) users.level_band (1:1 VocabBand
//   map), (3) default 'conversation'. REQ-AUTO-003 / EC-003-C.
async function resolveUserBand(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<VocabBand> {
  // Priority 1: user_vocab_profiles.estimated_band
  const { data: vocabProfile } = await supabase
    .from("user_vocab_profiles")
    .select("estimated_band")
    .eq("user_id", userId)
    .maybeSingle();

  if (vocabProfile && vocabProfile.estimated_band) {
    const band = vocabProfile.estimated_band as string;
    if (band in LEVEL_BAND_TO_VOCAB_BAND) {
      return clampToServableBand(LEVEL_BAND_TO_VOCAB_BAND[band]);
    }
  }

  // Priority 2: users.level_band (learning profile) — 1:1 map to VocabBand
  const { data: learningProfile } = await supabase
    .from("users")
    .select("level_band")
    .eq("id", userId)
    .maybeSingle();

  if (learningProfile && learningProfile.level_band) {
    const levelBand = learningProfile.level_band as string;
    if (levelBand in LEVEL_BAND_TO_VOCAB_BAND) {
      return clampToServableBand(LEVEL_BAND_TO_VOCAB_BAND[levelBand]);
    }
  }

  // Priority 3: default
  return "conversation";
}

// @MX:NOTE: [AUTO] fetchUserIl — Task 5.1 (SPEC-WEB-001 REQ-WEB-005-E1) secondary ranking
//   signal. Reads users.il_index (Phase 0 column, Phase 3 writer). Returns null when unset
//   (new/pre-Phase-3 users) — callers must degrade to pure band-fit ranking in that case,
//   identical to the existing interests=[] degrade pattern used by fetchUserInterests.
async function fetchUserIl(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("users")
    .select("il_index")
    .eq("id", userId)
    .maybeSingle();

  const il = data?.il_index;
  return typeof il === "number" ? il : null;
}

// @MX:ANCHOR: [AUTO] fetchUserInterests — single source of truth for user's topic/format interests.
// @MX:REASON: [AUTO] Fan-in from GET handler into all interest-aware assembly helpers. Reads
//   users.focus_tags (same table as resolveUserBand Priority 2), parses topic:/format: prefixes.
//   Returns empty arrays when no interests set — callers degrade gracefully to freshness ordering.
async function fetchUserInterests(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ topics: string[]; formats: string[] }> {
  const { data } = await supabase
    .from("users")
    .select("focus_tags")
    .eq("id", userId)
    .maybeSingle();

  const focusTags: string[] = Array.isArray(data?.focus_tags)
    ? data.focus_tags
    : [];
  const topics: string[] = [];
  const formats: string[] = [];

  for (const tag of focusTags) {
    if (typeof tag !== "string") continue;
    if (tag.startsWith("topic:")) {
      topics.push(tag.slice("topic:".length));
    } else if (tag.startsWith("format:")) {
      formats.push(tag.slice("format:".length));
    }
    // Unknown prefixes are silently ignored
  }

  return { topics, formats };
}

// @MX:ANCHOR: [AUTO] fetchPoolReadingForBand — primary reading pool source for session assembly.
// @MX:REASON: [AUTO] Pool reading (user_id IS NULL) is the single authoritative reading source
//   (REQ-AUTO-003-U2). Replaces fetchLatestReadingPieceForUser as 1st choice. Filters:
//   user_id IS NULL + band match + approved + not expired. Per-user reading may be kept as
//   last-resort fallback in a future phase but pool always wins here.
// @MX:NOTE: [AUTO] Per-user fallback reading is intentionally omitted in Phase 3; pool is the
//   canonical source. If pool is empty, assembly returns no reading (hasReading: false).
// @MX:NOTE: [AUTO] Interest ranking (secondary signal — band stays primary filter):
//   Fetches up to 20 candidates ordered by created_at DESC (freshness). Applies interest scores:
//   +2 if reading.topic ∈ interests.topics, +1 if reading.format ∈ interests.formats.
//   Picks highest-scoring candidate; ties keep DB order (stable sort → freshest wins).
//   With no interests, all scores are 0 → freshest reading wins (no behaviour change).
async function fetchPoolReadingForBand(
  supabase: ReturnType<typeof createAdminClient>,
  band: VocabBand,
  interests: { topics: string[]; formats: string[] } = {
    topics: [],
    formats: [],
  },
): Promise<ReadingPiece | null> {
  const now = new Date().toISOString();
  const CANDIDATE_LIMIT = 20;

  // Pass 1: approved pool rows with an active (non-expired) expires_at
  const { data: withExpiry, error: expErr } = await supabase
    .from("reading_pieces")
    .select("*")
    .is("user_id", null)
    .eq("band", band)
    .eq("validation_status", "approved")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  // Pass 2: approved pool rows where expires_at IS NULL (no expiry policy set)
  const { data: withoutExpiry, error: noExpErr } = await supabase
    .from("reading_pieces")
    .select("*")
    .is("user_id", null)
    .eq("band", band)
    .eq("validation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  // Merge candidates: prefer non-expired rows, add null-expiry rows not already present
  const candidateRows: Record<string, unknown>[] = [];
  if (!expErr && withExpiry) {
    for (const row of withExpiry as Record<string, unknown>[]) {
      candidateRows.push(row);
    }
  }
  if (!noExpErr && withoutExpiry) {
    const seenIds = new Set(candidateRows.map((r) => String(r.id)));
    for (const row of withoutExpiry as Record<string, unknown>[]) {
      if (!seenIds.has(String(row.id))) {
        candidateRows.push(row);
      }
    }
  }

  if (candidateRows.length === 0) return null;

  // Interest scoring: +2 topic match, +1 format match (secondary signal only)
  const hasInterests =
    interests.topics.length > 0 || interests.formats.length > 0;
  if (!hasInterests) {
    // No interests: return the freshest (first in DB order)
    return mapReadingPieceRow(candidateRows[0]);
  }

  const topicSet = new Set(interests.topics);
  const formatSet = new Set(interests.formats);

  let bestScore = -1;
  let bestRow = candidateRows[0];
  for (const row of candidateRows) {
    let score = 0;
    if (topicSet.has(String(row.topic ?? ""))) score += 2;
    if (formatSet.has(String(row.format ?? ""))) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  return mapReadingPieceRow(bestRow);
}

// @MX:ANCHOR: [AUTO] fetchSegmentsForBand — band-filtered segment selection replacing fetchRandomSegments.
// @MX:REASON: [AUTO] Fan-in from new session assembly path. This is the single pool query
//   for video segments, replacing the random selection of the old fetchRandomSegments. Must
//   never perform pure-random selection (REQ-AUTO-003-U1).
// @MX:NOTE: [AUTO] Band-fit ranking algorithm:
//   1. Fetch candidate set: prefer self_contained=true, order by created_at DESC (freshness).
//   2. In-JS rank by band_coverage[band] proximity to i+1 optimal (~0.95-0.98 coverage,
//      meaning 2-5% unknown words per Krashen i+1 principle).
//   3. Difficulty filter: prefer difficulty_score <= 3 for non-professional bands.
//   4. Return top `count` by combined band-fit score.
export async function fetchSegmentsForBand(
  supabase: ReturnType<typeof createAdminClient>,
  band: VocabBand,
  count: number,
  topics: string[] = [],
  userIl: number | null = null,
): Promise<VideoSegment[]> {
  // Fetch candidate pool: prefer self-contained segments, limit to reasonable candidate set
  const candidateLimit = Math.max(count * 5, 20);

  const { data, error } = await supabase
    .from("video_segments")
    .select("*")
    .eq("self_contained", true)
    .order("created_at", { ascending: false })
    .limit(candidateLimit);

  if (error || !data || data.length === 0) {
    // Fallback: no self_contained filter
    const { data: fallbackData } = await supabase
      .from("video_segments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(candidateLimit);

    if (!fallbackData || fallbackData.length === 0) return [];
    return rankAndSliceSegments(
      fallbackData.map((r) => mapVideoSegmentRow(r as Record<string, unknown>)),
      band,
      count,
      topics,
      userIl,
    );
  }

  return rankAndSliceSegments(
    data.map((r) => mapVideoSegmentRow(r as Record<string, unknown>)),
    band,
    count,
    topics,
    userIl,
  );
}

// @MX:NOTE: [AUTO] Band-fit scoring: target coverage ~0.95-0.98 for the given band.
//   Score = 1 - |coverage[band] - 0.965|  (higher = closer to i+1 sweet spot).
//   Difficulty bonus: segments at difficulty_score <= 3 get a 0.05 boost for non-professional bands.
// @MX:NOTE: [AUTO] Interest bonus (secondary signal — band-fit is primary):
//   +0.1 if seg.topicTags overlaps the user's topic interests. This tips ties and near-matches
//   without overriding band-fit: a 0.1 bonus cannot compensate a coverage gap > 0.1 (e.g. 0.965
//   vs 0.765 → gap of 0.2, bonus insufficient). Default topics=[] → no bonus → pure band-fit.
// @MX:NOTE: [AUTO] IL-proximity bonus (Task 5.1, SPEC-WEB-001 REQ-WEB-005-E1 — secondary signal,
//   band-fit stays primary): up to +0.1, scaled by closeness of seg.il to userIl (max bonus at
//   |delta|=0, 0 bonus at |delta|>=1.0 IL point). Mirrors the interest-bonus cap so IL proximity
//   alone can never override a band-fit gap > 0.1. Segments without an `il` value (pre-Phase-4
//   ingest) or a null userIl (pre-Phase-3 user) get 0 IL bonus — pure band-fit, no behavior change.
function ilProximityBonus(
  segIl: number | null | undefined,
  userIl: number | null,
): number {
  if (typeof segIl !== "number" || userIl === null) return 0;
  const delta = Math.abs(segIl - userIl);
  return Math.max(0, 0.1 * (1 - Math.min(delta, 1.0)));
}

export function rankAndSliceSegments(
  segments: VideoSegment[],
  band: VocabBand,
  count: number,
  topics: string[] = [],
  userIl: number | null = null,
): VideoSegment[] {
  const TARGET_COVERAGE = 0.965; // midpoint of 0.95-0.98 optimal range
  const topicSet = new Set(topics);

  const scored = segments.map((seg) => {
    const coverage = seg.bandCoverage[band] ?? 0;
    let score = 1 - Math.abs(coverage - TARGET_COVERAGE);

    // Difficulty bonus for non-professional bands
    if (
      band !== "professional" &&
      seg.difficultyScore !== null &&
      seg.difficultyScore <= 3
    ) {
      score += 0.05;
    }

    // Interest bonus: +0.1 if any topicTag overlaps user's topic interests (secondary signal)
    if (topicSet.size > 0 && seg.topicTags.some((t) => topicSet.has(t))) {
      score += 0.1;
    }

    // IL-proximity bonus (secondary signal, Task 5.1)
    score += ilProximityBonus(seg.il, userIl);

    return { seg, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(({ seg }) => seg);
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

// Bug fix: was using .eq("user_id", readingPieceId) — must use .eq("id", readingPieceId)
async function fetchReadingPieceById(
  supabase: ReturnType<typeof createAdminClient>,
  readingPieceId: string,
): Promise<ReadingPiece | null> {
  const { data, error } = await supabase
    .from("reading_pieces")
    .select("*")
    .eq("id", readingPieceId)
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

  // Bug fix: use .in("id", segment_ids) instead of .limit(n+5) then JS filter
  let segments: VideoSegment[] = [];
  if (ciSession.segment_ids.length > 0) {
    const { data } = await supabase
      .from("video_segments")
      .select("*")
      .in("id", ciSession.segment_ids);
    segments = (data ?? []).map((row) =>
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

// @MX:NOTE: [AUTO] ±1 band fallback: if userBand pool has insufficient segments, try adjacent
//   bands (nearest first). Ensures W1 requirement — never return empty session when adjacent
//   content exists.
function getAdjacentBands(band: VocabBand): VocabBand[] {
  const idx = BAND_ORDER.indexOf(band);
  const adjacent: VocabBand[] = [];
  if (idx > 0) adjacent.push(BAND_ORDER[idx - 1]);
  if (idx < BAND_ORDER.length - 1) adjacent.push(BAND_ORDER[idx + 1]);
  return adjacent;
}

// @MX:NOTE: [AUTO] Preparing state (REQ-AUTO-003-U3): when all bands (user + adjacent) are
//   empty, return an explicit "preparing" status. Do NOT insert a ci_sessions row — this
//   prevents poisoning the per-day cache with an empty session.
function buildPreparingSession(): TodaySessionResponse["session"] {
  return {
    id: `preparing-${Date.now()}`,
    date: TODAY(),
    readingPiece: null,
    segments: [],
    assemblyMeta: {
      status: "preparing",
      pool_band: null,
      fallback_band: null,
      pool_thin: true,
      assembledAt: new Date().toISOString(),
      segmentCount: 0,
      hasReading: false,
    },
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

    // Check for cached session (idempotent per-day per-user) — REQ-AUTO-003-U4
    const cached = await fetchCachedCiSession(supabase, user.id, today);

    let ciSession: CiSessionRow | null;
    let preparingSession: TodaySessionResponse["session"] | null = null;

    if (cached) {
      ciSession = cached;
    } else {
      // Resolve user's vocab band (REQ-AUTO-003-U1)
      const userBand = await resolveUserBand(supabase, user.id);

      // Fetch user's topic/format interests (secondary ranking signal only)
      const interests = await fetchUserInterests(supabase, user.id);

      // Fetch user's IL index (Task 5.1, secondary ranking signal only — null degrades
      // to pure band-fit, identical to the interests=[] degrade path above)
      const userIl = await fetchUserIl(supabase, user.id);

      // Fetch pool reading (primary) — REQ-AUTO-003-U2; interests used for secondary ranking
      const poolReading = await fetchPoolReadingForBand(
        supabase,
        userBand,
        interests,
      );

      // Fetch band-filtered segments — REQ-AUTO-003-U1; interests + IL used for secondary ranking
      let segments = await fetchSegmentsForBand(
        supabase,
        userBand,
        SEGMENT_COUNT,
        interests.topics,
        userIl,
      );
      let fallbackBand: VocabBand | null = null;
      let poolThin = false;

      // ±1 band fallback — REQ-AUTO-003-W1
      if (segments.length < SEGMENT_COUNT) {
        poolThin = true;
        const adjacentBands = getAdjacentBands(userBand);
        for (const adjBand of adjacentBands) {
          const needed = SEGMENT_COUNT - segments.length;
          const adjSegments = await fetchSegmentsForBand(
            supabase,
            adjBand,
            needed,
            interests.topics,
            userIl,
          );
          if (adjSegments.length > 0) {
            segments = [...segments, ...adjSegments];
            fallbackBand = adjBand;
            if (segments.length >= SEGMENT_COUNT) break;
          }
        }
      }

      // Empty pool → preparing state (REQ-AUTO-003-U3)
      // Do NOT insert ci_session when preparing
      if (segments.length === 0 && poolReading === null) {
        ciSession = null;
        preparingSession = buildPreparingSession();
      } else {
        const segmentIds = segments.map((s) => s.id);
        const assemblyMeta: Record<string, unknown> = {
          status: "ready",
          pool_band: userBand,
          fallback_band: fallbackBand,
          pool_thin: poolThin,
          assembledAt: new Date().toISOString(),
          segmentCount: segmentIds.length,
          hasReading: poolReading !== null,
          // Observability: how many interests were applied (counts of user's selections)
          interests_applied: {
            topics: interests.topics.length,
            formats: interests.formats.length,
          },
        };

        ciSession = await insertCiSession(
          supabase,
          user.id,
          today,
          poolReading?.id ?? null,
          segmentIds,
          assemblyMeta,
        );
      }
    }

    // Build response
    let session: TodaySessionResponse["session"];
    if (preparingSession) {
      session = preparingSession;
    } else {
      session = await buildSessionResponse(supabase, ciSession!);
    }

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
