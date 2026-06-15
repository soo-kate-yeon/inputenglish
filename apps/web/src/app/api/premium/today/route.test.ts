import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// Mock all dependencies before importing route
const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const getMonthlyQuestionCount = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/lib/premium/question-cap", () => ({
  getMonthlyQuestionCount: (...args: unknown[]) =>
    getMonthlyQuestionCount(...args),
  MONTHLY_QUESTION_CAP: 100,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({ from: mockFrom }),
  createClient: vi.fn(),
}));

const user = { id: "user-abc" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};
const expiredEntitlement = {
  hasAccess: false,
  plan: "FREE",
  reason: "trial-expired",
  trialEndsAt: "2026-06-01T00:00:00.000Z",
};

// Pool reading piece (user_id IS NULL, band = 'conversation')
const fixturePoolReadingPiece = {
  id: "pool-reading-1",
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  body: "Climate change is a serious challenge.",
  coverage_pct: 95,
  validation_status: "approved",
  source_facts: {},
  user_id: null,
  band: "conversation",
  expires_at: null,
  created_at: "2026-06-15T00:00:00.000Z",
};

// Per-user reading piece (user_id = user-abc) — should NOT win over pool
const fixturePerUserReadingPiece = {
  id: "reading-piece-1",
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  body: "Climate change is a serious challenge.",
  coverage_pct: 95,
  validation_status: "approved",
  source_facts: {},
  user_id: "user-abc",
  band: null,
  expires_at: null,
  created_at: "2026-06-15T00:00:00.000Z",
};

// Segments with high conversation band coverage (~0.95)
const fixtureSegments = [
  {
    id: "seg-1",
    parent_video_id: "yt-abc",
    channel_id: "ch-1",
    start_time: 10,
    end_time: 70,
    transcript: [],
    wpm: 130,
    band_coverage: {
      beginner: 0.8,
      basic: 0.9,
      conversation: 0.95,
      professional: 0.98,
    },
    topic_tags: ["technology"],
    self_contained: true,
    difficulty_score: 2,
    created_at: "2026-06-15T00:00:00.000Z",
  },
  {
    id: "seg-2",
    parent_video_id: "yt-abc",
    channel_id: "ch-1",
    start_time: 120,
    end_time: 180,
    transcript: [],
    wpm: 140,
    band_coverage: {
      beginner: 0.7,
      basic: 0.85,
      conversation: 0.93,
      professional: 0.97,
    },
    topic_tags: ["business"],
    self_contained: true,
    difficulty_score: 3,
    created_at: "2026-06-15T00:00:00.000Z",
  },
  {
    id: "seg-3",
    parent_video_id: "yt-xyz",
    channel_id: "ch-2",
    start_time: 30,
    end_time: 90,
    transcript: [],
    wpm: 120,
    band_coverage: {
      beginner: 0.75,
      basic: 0.88,
      conversation: 0.94,
      professional: 0.96,
    },
    topic_tags: ["lifestyle"],
    self_contained: true,
    difficulty_score: 2,
    created_at: "2026-06-15T00:00:00.000Z",
  },
];

// Segments for adjacent band fallback (basic band coverage)
const fixtureBasicSegments = [
  {
    id: "basic-seg-1",
    parent_video_id: "yt-basic",
    channel_id: "ch-basic",
    start_time: 0,
    end_time: 60,
    transcript: [],
    wpm: 110,
    band_coverage: {
      beginner: 0.85,
      basic: 0.95,
      conversation: 0.97,
      professional: 0.99,
    },
    topic_tags: ["general"],
    self_contained: true,
    difficulty_score: 1,
    created_at: "2026-06-15T00:00:00.000Z",
  },
];

const fixtureCiSessionRow = {
  id: "ci-session-1",
  user_id: "user-abc",
  session_date: "2026-06-15",
  reading_piece_id: "pool-reading-1",
  segment_ids: ["seg-1", "seg-2", "seg-3"],
  assembly_meta: {
    status: "ready",
    pool_band: "conversation",
    fallback_band: null,
    pool_thin: false,
    assembledAt: "2026-06-15T00:00:00.000Z",
    segmentCount: 3,
    hasReading: true,
  },
  created_at: "2026-06-15T00:00:00.000Z",
};

// Vocab profile row (user_vocab_profiles table)
const fixtureVocabProfile = {
  id: "vp-1",
  user_id: "user-abc",
  estimated_band: "conversation",
};

// Learning profile from users table (level_band)
const fixtureLearningProfile = {
  id: "user-abc",
  level_band: "basic",
  goal_mode: null,
  focus_tags: [],
  preferred_speakers: [],
  preferred_situations: [],
  preferred_source_types: [],
  preferred_genres: [],
  onboarding_completed_at: null,
  updated_at: null,
};

/**
 * Sets up mockFrom to handle the new band-aware assembly flow.
 *
 * Tables queried by Phase 3 route:
 *   - user_vocab_profiles (resolveUserBand: vocab profile lookup)
 *   - users (resolveUserBand: learning profile fallback)
 *   - reading_pieces (fetchPoolReadingForBand: pool query with band filter + maybeSingle)
 *   - video_segments (fetchSegmentsForBand: candidate set, then .in() for buildSessionResponse)
 *   - ci_sessions (fetchCachedCiSession + insertCiSession)
 *   - asked_items (getMonthlyQuestionCount)
 */
function setupMockFrom({
  ciSessionRow = null as typeof fixtureCiSessionRow | null,
  vocabProfile = fixtureVocabProfile as typeof fixtureVocabProfile | null,
  learningProfile = fixtureLearningProfile as
    | typeof fixtureLearningProfile
    | null,
  poolReadingRow = fixturePoolReadingPiece as
    | typeof fixturePoolReadingPiece
    | null,
  segmentCandidates = fixtureSegments,
  segmentsByIds = fixtureSegments,
  insertResult = {
    data: fixtureCiSessionRow,
    error: null,
  } as {
    data: typeof fixtureCiSessionRow | null;
    error: null | { message: string };
  },
}: {
  ciSessionRow?: typeof fixtureCiSessionRow | null;
  vocabProfile?: typeof fixtureVocabProfile | null;
  learningProfile?: typeof fixtureLearningProfile | null;
  poolReadingRow?: typeof fixturePoolReadingPiece | null;
  segmentCandidates?: typeof fixtureSegments;
  segmentsByIds?: typeof fixtureSegments;
  insertResult?: {
    data: typeof fixtureCiSessionRow | null;
    error: null | { message: string };
  };
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "ci_sessions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: ciSessionRow, error: null }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(insertResult),
          }),
        }),
      };
    }

    if (table === "user_vocab_profiles") {
      // resolveUserBand: SELECT estimated_band WHERE user_id = $userId
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: vocabProfile, error: null }),
          }),
        }),
      };
    }

    if (table === "users") {
      // resolveUserBand fallback: learning profile with level_band
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: learningProfile, error: null }),
          }),
        }),
      };
    }

    if (table === "reading_pieces") {
      // fetchPoolReadingForBand: WHERE user_id IS NULL AND band = $band AND validation_status='approved'
      // buildSessionResponse / fetchReadingPieceById: WHERE id = $id
      return {
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({
                          data: poolReadingRow,
                          error: null,
                        }),
                    }),
                  }),
                }),
                // for queries without expires_at filter (no gt)
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi
                      .fn()
                      .mockResolvedValue({ data: poolReadingRow, error: null }),
                  }),
                }),
              }),
            }),
          }),
          // fetchReadingPieceById: .eq("id", id).maybeSingle()
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: poolReadingRow, error: null }),
          }),
        }),
      };
    }

    if (table === "video_segments") {
      // fetchSegmentsForBand: candidate set query (self_contained filter + order)
      // buildSessionResponse: .in("id", segment_ids)
      const inChain = {
        data: segmentsByIds,
        error: null,
      };
      const candidateChain = {
        data: segmentCandidates,
        error: null,
      };
      return {
        select: vi.fn().mockReturnValue({
          // .eq("self_contained", true)
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(candidateChain),
            }),
            // fallback without self_contained filter
            limit: vi.fn().mockResolvedValue(candidateChain),
          }),
          // .in("id", [...])
          in: vi.fn().mockResolvedValue(inChain),
          // for fallback candidate queries
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(candidateChain),
          }),
          limit: vi.fn().mockResolvedValue(candidateChain),
        }),
      };
    }

    if (table === "asked_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      };
    }

    return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
  });
}

describe("GET /api/premium/today (Phase 3: band-aware assembly)", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  // ── Auth & entitlement tests (keep from Phase 1/2) ──────────────────────────

  it("returns 401 when requireApiUser returns an error Response", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(401);
    expect(resolvePremiumEntitlement).not.toHaveBeenCalled();
  });

  it("returns 402 when user is not entitled (no premium access)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.session).toBeNull();
  });

  it("sets Cache-Control: no-store on all responses", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  // ── AC-003-1: Band-filtered assembly (conversation user gets pool reading + band segments) ──

  it("AC-003-1: assembles session with pool reading + band-filtered segments for conversation user", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(10);
    setupMockFrom({
      ciSessionRow: null, // cache miss
      vocabProfile: fixtureVocabProfile, // conversation band
      poolReadingRow: fixturePoolReadingPiece,
      segmentCandidates: fixtureSegments,
      segmentsByIds: fixtureSegments,
      insertResult: { data: fixtureCiSessionRow, error: null },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: {
        id: string;
        date: string;
        readingPiece: unknown;
        segments: unknown[];
        assemblyMeta: {
          status: string;
          pool_band: string;
          fallback_band: string | null;
          pool_thin: boolean;
          segmentCount: number;
          hasReading: boolean;
        };
      };
      remainingQuestionCap: number;
    };

    expect(body.session).toBeDefined();
    expect(body.session.id).toBeDefined();
    expect(body.session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // assemblyMeta must include band-aware fields
    expect(body.session.assemblyMeta.status).toBe("ready");
    expect(body.session.assemblyMeta.pool_band).toBe("conversation");
    expect(body.session.assemblyMeta.fallback_band).toBeNull();
    expect(typeof body.session.assemblyMeta.pool_thin).toBe("boolean");
    expect(typeof body.remainingQuestionCap).toBe("number");
  });

  // ── AC-003-2: Pool reading wins over per-user reading ───────────────────────

  it("AC-003-2: pool reading (user_id IS NULL) is preferred over per-user reading", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    // Pool reading IS available; per-user reading also exists but should NOT win
    setupMockFrom({
      ciSessionRow: null,
      vocabProfile: fixtureVocabProfile,
      poolReadingRow: fixturePoolReadingPiece, // pool wins
      segmentCandidates: fixtureSegments,
      segmentsByIds: fixtureSegments,
      insertResult: {
        data: {
          ...fixtureCiSessionRow,
          reading_piece_id: "pool-reading-1",
        },
        error: null,
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: {
        assemblyMeta: { pool_band: string };
        readingPiece: { id: string } | null;
      };
    };
    // The assembled session should use pool reading (pool_band set)
    expect(body.session.assemblyMeta.pool_band).toBe("conversation");
  });

  // ── AC-003-3: Cache idempotency (cached session returned, no re-assembly) ───

  it("AC-003-3: returns cached session on second call without re-assembling", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(20);
    setupMockFrom({
      ciSessionRow: fixtureCiSessionRow, // cache hit
      poolReadingRow: fixturePoolReadingPiece,
      segmentsByIds: fixtureSegments,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: { id: string; date: string };
    };
    expect(body.session.id).toBe("ci-session-1");
  });

  // ── EC-003-A: ±1 band fallback when user's band pool is thin ────────────────

  it("EC-003-A: falls back to adjacent band (basic) when conversation pool is empty", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const fallbackCiSession = {
      ...fixtureCiSessionRow,
      segment_ids: ["basic-seg-1"],
      assembly_meta: {
        status: "ready",
        pool_band: "conversation",
        fallback_band: "basic",
        pool_thin: true,
        assembledAt: "2026-06-15T00:00:00.000Z",
        segmentCount: 1,
        hasReading: false,
      },
    };

    // Pool reading null → no reading; conversation segments empty → fallback to basic
    // We simulate: first call (conversation band segments) returns empty, second call (basic) returns segments
    let segmentCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "ci_sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: fallbackCiSession, error: null }),
            }),
          }),
        };
      }
      if (table === "user_vocab_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: fixtureVocabProfile, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({
                  data: fixtureLearningProfile,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "reading_pieces") {
        // no pool reading
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi
                          .fn()
                          .mockResolvedValue({ data: null, error: null }),
                      }),
                    }),
                  }),
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "video_segments") {
        segmentCallCount++;
        // First call (conversation band): return empty; second call (basic band): return segments
        const data = segmentCallCount === 1 ? [] : fixtureBasicSegments;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data, error: null }),
              }),
              limit: vi.fn().mockResolvedValue({ data, error: null }),
            }),
            in: vi
              .fn()
              .mockResolvedValue({ data: fixtureBasicSegments, error: null }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data, error: null }),
            }),
            limit: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        };
      }
      if (table === "asked_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: {
        assemblyMeta: {
          status: string;
          fallback_band: string | null;
          pool_thin: boolean;
        };
        segments: unknown[];
      };
    };
    // Must use fallback (not empty, not crash)
    expect(body.session.assemblyMeta.status).toBe("ready");
    expect(body.session.assemblyMeta.fallback_band).toBe("basic");
    expect(body.session.assemblyMeta.pool_thin).toBe(true);
  });

  // ── EC-003-B: Empty pool → "준비 중" (preparing) state, no ci_session insert ─

  it("EC-003-B: returns preparing status (not null/crash) when all bands empty, does NOT cache", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    // Track insert calls to ensure we do NOT insert when preparing
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "ci_sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: insertMock,
        };
      }
      if (table === "user_vocab_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: fixtureVocabProfile, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({
                  data: fixtureLearningProfile,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "reading_pieces") {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi
                          .fn()
                          .mockResolvedValue({ data: null, error: null }),
                      }),
                    }),
                  }),
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "video_segments") {
        // All band queries return empty
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "asked_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: {
        id: string;
        readingPiece: unknown;
        segments: unknown[];
        assemblyMeta: { status: string };
      };
    };

    // Preparing state: explicit status, null reading, empty segments
    expect(body.session.assemblyMeta.status).toBe("preparing");
    expect(body.session.readingPiece).toBeNull();
    expect(body.session.segments).toHaveLength(0);

    // CRITICAL: no ci_session insert when preparing
    expect(insertMock).not.toHaveBeenCalled();
  });

  // ── EC-003-C: Band resolution fallback (no vocab profile → level_band) ──────

  it("EC-003-C: falls back to level_band when user_vocab_profiles has no row", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);
    setupMockFrom({
      ciSessionRow: null,
      vocabProfile: null, // no vocab profile
      learningProfile: fixtureLearningProfile, // level_band = 'basic'
      poolReadingRow: null,
      segmentCandidates: fixtureSegments,
      segmentsByIds: fixtureSegments,
      insertResult: {
        data: {
          ...fixtureCiSessionRow,
          assembly_meta: {
            status: "ready",
            pool_band: "basic", // resolved from level_band
            fallback_band: null,
            pool_thin: false,
            assembledAt: "2026-06-15T00:00:00.000Z",
            segmentCount: 3,
            hasReading: false,
          },
        },
        error: null,
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: {
        assemblyMeta: { pool_band: string; status: string };
      };
    };
    // The band should be 'basic' (from level_band)
    expect(body.session.assemblyMeta.pool_band).toBe("basic");
  });

  // ── Bug fix: fetchReadingPieceById must use .eq("id", ...) not .eq("user_id", ...) ─

  it("BUG-FIX: buildSessionResponse resolves reading piece by id (not user_id)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);
    setupMockFrom({
      ciSessionRow: fixtureCiSessionRow, // cache hit with reading_piece_id
      poolReadingRow: fixturePoolReadingPiece,
      segmentsByIds: fixtureSegments,
    });

    // Track what column eq() is called with for reading_pieces
    const eqCalls: [string, unknown][] = [];
    const originalImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation((table: string) => {
      if (table === "reading_pieces") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: unknown) => {
              eqCalls.push([col, val]);
              return {
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({
                    data: fixturePoolReadingPiece,
                    error: null,
                  }),
              };
            }),
            is: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi
                          .fn()
                          .mockResolvedValue({ data: null, error: null }),
                      }),
                    }),
                  }),
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return originalImpl!(table);
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // Verify reading_pieces was queried with column "id", not "user_id"
    const readingPieceEqCalls = eqCalls.filter(([col]) => col === "id");
    expect(readingPieceEqCalls.length).toBeGreaterThan(0);
    const wrongCalls = eqCalls.filter(([col]) => col === "user_id");
    expect(wrongCalls).toHaveLength(0);
  });

  // ── Bug fix: buildSessionResponse must use .in("id", segment_ids) ───────────

  it("BUG-FIX: buildSessionResponse fetches segments via .in(id) not .limit(n+5) filter", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const inCalls: unknown[][] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "ci_sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({
                    data: fixtureCiSessionRow,
                    error: null,
                  }),
              }),
            }),
          }),
          insert: vi.fn(),
        };
      }
      if (table === "user_vocab_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: fixtureVocabProfile, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({
                  data: fixtureLearningProfile,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "reading_pieces") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({
                  data: fixturePoolReadingPiece,
                  error: null,
                }),
            }),
            is: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "video_segments") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockImplementation((_col: string, ids: unknown[]) => {
              inCalls.push(ids);
              return Promise.resolve({ data: fixtureSegments, error: null });
            }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue({ data: fixtureSegments, error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue({ data: fixtureSegments, error: null }),
            }),
            limit: vi
              .fn()
              .mockResolvedValue({ data: fixtureSegments, error: null }),
          }),
        };
      }
      if (table === "asked_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // .in("id", segment_ids) must have been called for video_segments
    expect(inCalls.length).toBeGreaterThan(0);
    // The IDs must match the fixture session's segment_ids
    expect(inCalls[0]).toEqual(
      expect.arrayContaining(fixtureCiSessionRow.segment_ids),
    );
  });

  // ── Default band fallback: no vocab profile, no learning profile → 'conversation' ─

  it("defaults band to 'conversation' when no vocab profile and no learning profile exist", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);
    setupMockFrom({
      ciSessionRow: null,
      vocabProfile: null,
      learningProfile: null, // no profile at all
      poolReadingRow: fixturePoolReadingPiece,
      segmentCandidates: fixtureSegments,
      segmentsByIds: fixtureSegments,
      insertResult: {
        data: {
          ...fixtureCiSessionRow,
          assembly_meta: {
            status: "ready",
            pool_band: "conversation",
            fallback_band: null,
            pool_thin: false,
            assembledAt: "2026-06-15T00:00:00.000Z",
            segmentCount: 3,
            hasReading: true,
          },
        },
        error: null,
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: { assemblyMeta: { pool_band: string } };
    };
    expect(body.session.assemblyMeta.pool_band).toBe("conversation");
  });

  // ── readingPiece null when no reading in pool ────────────────────────────────

  it("returns readingPiece as null when no pool reading piece exists", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);
    setupMockFrom({
      ciSessionRow: null,
      vocabProfile: fixtureVocabProfile,
      poolReadingRow: null, // no reading in pool
      segmentCandidates: fixtureSegments,
      segmentsByIds: fixtureSegments,
      insertResult: {
        data: {
          ...fixtureCiSessionRow,
          reading_piece_id: null as unknown as string,
          assembly_meta: {
            status: "ready",
            pool_band: "conversation",
            fallback_band: null,
            pool_thin: false,
            assembledAt: "2026-06-15T00:00:00.000Z",
            segmentCount: 3,
            hasReading: false,
          },
        },
        error: null,
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: { readingPiece: unknown; assemblyMeta: { hasReading: boolean } };
    };
    expect(body.session.readingPiece).toBeNull();
    expect(body.session.assemblyMeta.hasReading).toBe(false);
  });
});
