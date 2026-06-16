/**
 * TDD — Interest-aware session assembly tests
 *
 * Covers:
 *   - fetchUserInterests: parse topic:/format: prefixes from users.focus_tags
 *   - fetchPoolReadingForBand (interest ranking): topic match wins over fresher non-match
 *   - rankAndSliceSegments (interest bonus): topicTags overlap adds 0.1 bonus, band-fit still dominates
 *   - GET handler: passes interests through; assemblyMeta includes interests_applied; existing tests pass
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

// ── Shared fixtures ────────────────────────────────────────────────────────────

const user = { id: "user-abc" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};

// Vocab profile for band resolution (Priority 1 → conversation)
const fixtureVocabProfile = {
  user_id: "user-abc",
  estimated_band: "conversation",
};

// Learning profile with focus_tags including topic and format interests
const fixtureLearningProfileWithInterests = {
  id: "user-abc",
  level_band: "conversation",
  goal_mode: null,
  focus_tags: ["topic:science", "topic:technology", "format:nonfiction"],
  preferred_speakers: [],
  preferred_situations: [],
  preferred_source_types: [],
  preferred_genres: [],
  onboarding_completed_at: null,
  updated_at: null,
};

// Learning profile with NO interests (empty focus_tags)
const fixtureLearningProfileNoInterests = {
  id: "user-abc",
  level_band: "conversation",
  goal_mode: null,
  focus_tags: [],
  preferred_speakers: [],
  preferred_situations: [],
  preferred_source_types: [],
  preferred_genres: [],
  onboarding_completed_at: null,
  updated_at: null,
};

// Learning profile with null focus_tags (cast to match real DB row shape)
const fixtureLearningProfileNullTags = {
  id: "user-abc",
  level_band: "conversation",
  goal_mode: null,
  focus_tags: null as unknown as string[],
  preferred_speakers: [],
  preferred_situations: [],
  preferred_source_types: [],
  preferred_genres: [],
  onboarding_completed_at: null,
  updated_at: null,
};

// Learning profile with unknown tag prefixes (should be ignored)
const fixtureLearningProfileMixedTags = {
  id: "user-abc",
  level_band: "conversation",
  goal_mode: null,
  focus_tags: [
    "topic:health",
    "unknown:value",
    "format:editorial",
    "garbage",
    "topic:climate",
  ],
  preferred_speakers: [],
  preferred_situations: [],
  preferred_source_types: [],
  preferred_genres: [],
  onboarding_completed_at: null,
  updated_at: null,
};

// Pool reading candidates for interest ranking tests
// - Older but matches user's topic (science)
const fixtureReadingOlderTopicMatch = {
  id: "reading-older-topic-match",
  level: "B1",
  format: "nonfiction",
  topic: "science",
  body: "Science topic body.",
  coverage_pct: 95,
  validation_status: "approved",
  source_facts: {},
  user_id: null,
  band: "conversation",
  expires_at: null,
  created_at: "2026-05-01T00:00:00.000Z", // older
};

// - Fresher but topic does NOT match user interests
const fixtureReadingFresherNoMatch = {
  id: "reading-fresher-no-match",
  level: "B1",
  format: "dialogue",
  topic: "economics",
  body: "Economics topic body.",
  coverage_pct: 90,
  validation_status: "approved",
  source_facts: {},
  user_id: null,
  band: "conversation",
  expires_at: null,
  created_at: "2026-06-01T00:00:00.000Z", // fresher
};

// - Fresher and format matches user's format interest (nonfiction)
const fixtureReadingFresherFormatMatch = {
  id: "reading-fresher-format-match",
  level: "B1",
  format: "nonfiction",
  topic: "history",
  body: "History body.",
  coverage_pct: 92,
  validation_status: "approved",
  source_facts: {},
  user_id: null,
  band: "conversation",
  expires_at: null,
  created_at: "2026-05-15T00:00:00.000Z", // between above two
};

// Segments for interest ranking tests (all near-equal band-fit)
const fixtureSegmentTopicMatch = {
  id: "seg-topic-match",
  parent_video_id: "yt-1",
  channel_id: "ch-1",
  start_time: 0,
  end_time: 60,
  transcript: [],
  wpm: 130,
  band_coverage: {
    beginner: 0.8,
    basic: 0.9,
    conversation: 0.962, // very close to 0.965 target
    professional: 0.98,
  },
  topic_tags: ["science"], // matches user's topic:science
  self_contained: true,
  difficulty_score: 2,
  created_at: "2026-06-15T00:00:00.000Z",
};

const fixtureSegmentNoTopicMatch = {
  id: "seg-no-topic-match",
  parent_video_id: "yt-2",
  channel_id: "ch-2",
  start_time: 0,
  end_time: 60,
  transcript: [],
  wpm: 135,
  band_coverage: {
    beginner: 0.8,
    basic: 0.9,
    conversation: 0.962, // same band-fit as above (tied)
    professional: 0.98,
  },
  topic_tags: ["cooking"], // does NOT match user interests
  self_contained: true,
  difficulty_score: 2,
  created_at: "2026-06-15T00:00:00.000Z",
};

// Segment with much better band-fit but no topic match
// Band-fit gap is 0.2 points (0.965 vs 0.765), so interest bonus 0.1 should NOT override
const fixtureSegmentBetterBandFitNoTopic = {
  id: "seg-better-band-fit",
  parent_video_id: "yt-3",
  channel_id: "ch-3",
  start_time: 0,
  end_time: 60,
  transcript: [],
  wpm: 130,
  band_coverage: {
    beginner: 0.8,
    basic: 0.9,
    conversation: 0.965, // perfect band-fit (score = 1.0)
    professional: 0.98,
  },
  topic_tags: ["cooking"], // no topic match
  self_contained: true,
  difficulty_score: 2,
  created_at: "2026-06-15T00:00:00.000Z",
};

const fixtureSegmentWorseTopicMatch = {
  id: "seg-worse-band-fit-topic",
  parent_video_id: "yt-4",
  channel_id: "ch-4",
  start_time: 0,
  end_time: 60,
  transcript: [],
  wpm: 130,
  band_coverage: {
    beginner: 0.6,
    basic: 0.7,
    conversation: 0.765, // very poor band-fit (far from 0.965)
    professional: 0.85,
  },
  topic_tags: ["science"], // matches topic but band-fit is terrible
  self_contained: true,
  difficulty_score: 2,
  created_at: "2026-06-15T00:00:00.000Z",
};

const fixtureCiSessionWithInterests = {
  id: "ci-session-interests-1",
  user_id: "user-abc",
  session_date: "2026-06-15",
  reading_piece_id: "reading-older-topic-match",
  segment_ids: ["seg-topic-match", "seg-no-topic-match"],
  assembly_meta: {
    status: "ready",
    pool_band: "conversation",
    fallback_band: null,
    pool_thin: false,
    assembledAt: "2026-06-15T00:00:00.000Z",
    segmentCount: 2,
    hasReading: true,
    interests_applied: { topics: 2, formats: 1 },
  },
  created_at: "2026-06-15T00:00:00.000Z",
};

// ── Helper: build a supabase mock with multi-candidate reading support ─────────
/**
 * Builds a mock that returns a candidate list from reading_pieces
 * (simulating the new fetchPoolReadingForBand candidate-set approach).
 * The route itself ranks them; we need the mock to return multiple rows.
 */
function buildReadingPiecesMock(
  candidates: (typeof fixtureReadingOlderTopicMatch)[],
) {
  return {
    select: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: candidates,
                  error: null,
                }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: candidates,
                error: null,
              }),
            }),
          }),
        }),
      }),
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: candidates[0] ?? null,
          error: null,
        }),
      }),
    }),
  };
}

function buildVideoSegmentsMock(
  candidates: (typeof fixtureSegmentTopicMatch)[],
  byIds?: (typeof fixtureSegmentTopicMatch)[],
) {
  const resolvedByIds = byIds ?? candidates;
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: candidates, error: null }),
        }),
        limit: vi.fn().mockResolvedValue({ data: candidates, error: null }),
      }),
      in: vi.fn().mockResolvedValue({ data: resolvedByIds, error: null }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: candidates, error: null }),
      }),
      limit: vi.fn().mockResolvedValue({ data: candidates, error: null }),
    }),
  };
}

function buildCiSessionsMock(
  cachedRow: typeof fixtureCiSessionWithInterests | null,
  insertData: typeof fixtureCiSessionWithInterests,
) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: cachedRow, error: null }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: insertData, error: null }),
      }),
    }),
  };
}

function buildUsersMock(
  learningProfile: typeof fixtureLearningProfileWithInterests | null,
) {
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

function buildVocabProfileMock(
  vocabProfile: typeof fixtureVocabProfile | null,
) {
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

function buildAskedItemsMock(count: number = 5) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: fetchUserInterests (unit-level via users table mock)
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchUserInterests — parsing focus_tags from users table", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("INT-001: parses topic: and format: prefixes from focus_tags, strips prefix", async () => {
    // We verify interests_applied in assemblyMeta to indirectly test parsing
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            ...fixtureCiSessionWithInterests,
            assembly_meta: {
              ...fixtureCiSessionWithInterests.assembly_meta,
              interests_applied: { topics: 2, formats: 1 },
            },
          },
          error: null,
        }),
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileWithInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingOlderTopicMatch]);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
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
          interests_applied?: { topics: number; formats: number };
        };
      };
    };

    // interests_applied should be present with counts from focus_tags
    expect(body.session.assemblyMeta.interests_applied).toBeDefined();
    // focus_tags = ["topic:science", "topic:technology", "format:nonfiction"]
    // → topics: ["science", "technology"] (2), formats: ["nonfiction"] (1)
    expect(body.session.assemblyMeta.interests_applied).toEqual({
      topics: 2,
      formats: 1,
    });
  });

  it("INT-002: returns { topics: [], formats: [] } when focus_tags is empty", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            ...fixtureCiSessionWithInterests,
            assembly_meta: {
              ...fixtureCiSessionWithInterests.assembly_meta,
              interests_applied: { topics: 0, formats: 0 },
            },
          },
          error: null,
        }),
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileNoInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingFresherNoMatch]);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
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
          interests_applied?: { topics: number; formats: number };
        };
      };
    };

    expect(body.session.assemblyMeta.interests_applied).toEqual({
      topics: 0,
      formats: 0,
    });
  });

  it("INT-003: ignores unknown prefixes (non topic:/format:), null focus_tags returns empty", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            ...fixtureCiSessionWithInterests,
            assembly_meta: {
              ...fixtureCiSessionWithInterests.assembly_meta,
              interests_applied: { topics: 0, formats: 0 },
            },
          },
          error: null,
        }),
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileNullTags);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingFresherNoMatch]);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
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
          interests_applied?: { topics: number; formats: number };
        };
      };
    };

    // null focus_tags → { topics: 0, formats: 0 }
    expect(body.session.assemblyMeta.interests_applied).toEqual({
      topics: 0,
      formats: 0,
    });
  });

  it("INT-004: parses mixed tags, counts only valid topic: and format: prefixes", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    // focus_tags: ["topic:health", "unknown:value", "format:editorial", "garbage", "topic:climate"]
    // → topics: ["health", "climate"] (2), formats: ["editorial"] (1)

    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            ...fixtureCiSessionWithInterests,
            assembly_meta: {
              ...fixtureCiSessionWithInterests.assembly_meta,
              interests_applied: { topics: 2, formats: 1 },
            },
          },
          error: null,
        }),
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileMixedTags);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingFresherNoMatch]);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
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
          interests_applied?: { topics: number; formats: number };
        };
      };
    };

    expect(body.session.assemblyMeta.interests_applied).toEqual({
      topics: 2,
      formats: 1,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: fetchPoolReadingForBand — interest-based candidate ranking
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchPoolReadingForBand — interest ranking among band candidates", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("POOL-001: topic-matching reading wins over fresher non-matching reading", async () => {
    /**
     * Scenario:
     *   User interests: topics=["science", "technology"], formats=["nonfiction"]
     *   Candidates (returned by DB, newest first):
     *     1. fixtureReadingFresherNoMatch (topic: economics, format: dialogue) — score 0
     *     2. fixtureReadingOlderTopicMatch (topic: science, format: nonfiction) — score 3 (+2 topic +1 format)
     *
     *   Expected: older reading chosen because score is higher
     */
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    // Candidates: fresher (no match) first, older (topic+format match) second
    const candidates = [
      fixtureReadingFresherNoMatch,
      fixtureReadingOlderTopicMatch,
    ];

    // We track which reading_piece_id is inserted to know which was chosen
    let capturedReadingPieceId: string | null = null;
    const insertSpy = vi
      .fn()
      .mockImplementation((rows: Array<Record<string, unknown>>) => {
        capturedReadingPieceId = rows[0]?.reading_piece_id as string | null;
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...fixtureCiSessionWithInterests,
                reading_piece_id: capturedReadingPieceId,
              },
              error: null,
            }),
          }),
        };
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileWithInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock(candidates);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // The topic-matching (older) reading should have been chosen
    expect(capturedReadingPieceId).toBe(fixtureReadingOlderTopicMatch.id);
  });

  it("POOL-002: format-only match wins over no-match reading when topic doesn't match", async () => {
    /**
     * Scenario:
     *   User interests: topics=["science", "technology"], formats=["nonfiction"]
     *   Candidates (newest first):
     *     1. fixtureReadingFresherNoMatch (format: dialogue) — score 0
     *     2. fixtureReadingFresherFormatMatch (format: nonfiction) — score +1
     *
     *   Expected: format-matching reading chosen
     */
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const candidates = [
      fixtureReadingFresherNoMatch,
      fixtureReadingFresherFormatMatch,
    ];

    let capturedReadingPieceId: string | null = null;
    const insertSpy = vi
      .fn()
      .mockImplementation((rows: Array<Record<string, unknown>>) => {
        capturedReadingPieceId = rows[0]?.reading_piece_id as string | null;
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...fixtureCiSessionWithInterests,
                reading_piece_id: capturedReadingPieceId,
              },
              error: null,
            }),
          }),
        };
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileWithInterests);
      if (table === "reading_pieces") return buildReadingPiecesMock(candidates);
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    expect(capturedReadingPieceId).toBe(fixtureReadingFresherFormatMatch.id);
  });

  it("POOL-003: with no interests, freshest reading wins (no behaviour change)", async () => {
    /**
     * Scenario:
     *   User interests: topics=[], formats=[]
     *   Candidates: [fresher, older] — all score 0 with interests
     *   Expected: first (fresher) chosen (stable sort preserves created_at DESC order)
     */
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const candidates = [
      fixtureReadingFresherNoMatch,
      fixtureReadingOlderTopicMatch,
    ];

    let capturedReadingPieceId: string | null = null;
    const insertSpy = vi
      .fn()
      .mockImplementation((rows: Array<Record<string, unknown>>) => {
        capturedReadingPieceId = rows[0]?.reading_piece_id as string | null;
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...fixtureCiSessionWithInterests,
                reading_piece_id: capturedReadingPieceId,
              },
              error: null,
            }),
          }),
        };
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileNoInterests);
      if (table === "reading_pieces") return buildReadingPiecesMock(candidates);
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // No interests → scores all equal → V8 stable sort keeps DB order → fresher wins
    expect(capturedReadingPieceId).toBe(fixtureReadingFresherNoMatch.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: rankAndSliceSegments — interest bonus (+0.1)
// ─────────────────────────────────────────────────────────────────────────────

describe("rankAndSliceSegments — interest bonus does not override band-fit", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("SEG-001: topic-matching segment outranks equally-band-fit non-matching segment", async () => {
    /**
     * Scenario:
     *   User interests: topics=["science", "technology"]
     *   Candidates (equal band-fit, coverage = 0.962 both):
     *     seg-topic-match (topicTags: ["science"]) → base score ~0.997, +0.1 bonus = ~1.097
     *     seg-no-topic-match (topicTags: ["cooking"]) → base score ~0.997, no bonus = ~0.997
     *
     *   Expected: seg-topic-match ranks first (interest tips the tie)
     */
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    // We track which segment IDs are inserted into ci_sessions
    let capturedSegmentIds: string[] = [];
    const insertSpy = vi
      .fn()
      .mockImplementation((rows: Array<Record<string, unknown>>) => {
        capturedSegmentIds = (rows[0]?.segment_ids as string[]) ?? [];
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...fixtureCiSessionWithInterests,
                segment_ids: capturedSegmentIds,
              },
              error: null,
            }),
          }),
        };
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileWithInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingOlderTopicMatch]);
      }
      if (table === "video_segments") {
        // Return no-match first (to verify interest ranking re-orders correctly)
        return buildVideoSegmentsMock(
          [fixtureSegmentNoTopicMatch, fixtureSegmentTopicMatch],
          [fixtureSegmentNoTopicMatch, fixtureSegmentTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // seg-topic-match must be first in the inserted segment_ids (rank 1)
    expect(capturedSegmentIds[0]).toBe(fixtureSegmentTopicMatch.id);
  });

  it("SEG-002: band-fit dominates when coverage gap is large (interest bonus 0.1 insufficient)", async () => {
    /**
     * Scenario:
     *   User interests: topics=["science"]
     *   Candidates:
     *     seg-better-band-fit: coverage=0.965 (perfect), no topic match → score = 1.0 + 0.05 difficulty = 1.05
     *     seg-worse-topic-match: coverage=0.765 (very poor), topic=science → base = 1-|0.765-0.965| = 0.8, +0.05 difficulty + 0.1 interest = 0.95
     *
     *   Expected: seg-better-band-fit wins (1.05 > 0.95)
     *   This confirms interest bonus cannot override a large band-fit gap
     */
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    let capturedSegmentIds: string[] = [];
    const insertSpy = vi
      .fn()
      .mockImplementation((rows: Array<Record<string, unknown>>) => {
        capturedSegmentIds = (rows[0]?.segment_ids as string[]) ?? [];
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...fixtureCiSessionWithInterests,
                segment_ids: capturedSegmentIds,
              },
              error: null,
            }),
          }),
        };
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileWithInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingOlderTopicMatch]);
      }
      if (table === "video_segments") {
        // worse-band-fit topic-match listed first, better-band-fit no-match second
        return buildVideoSegmentsMock(
          [fixtureSegmentWorseTopicMatch, fixtureSegmentBetterBandFitNoTopic],
          [fixtureSegmentWorseTopicMatch, fixtureSegmentBetterBandFitNoTopic],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // Band-fit winner must rank first
    expect(capturedSegmentIds[0]).toBe(fixtureSegmentBetterBandFitNoTopic.id);
  });

  it("SEG-003: with no interests, segment order unchanged from band-fit-only ranking", async () => {
    /**
     * Scenario:
     *   User interests: topics=[], formats=[]
     *   Candidates:
     *     seg-better-band-fit: coverage=0.965 (score=1.0), no topic match
     *     seg-topic-match: coverage=0.962 (score=0.997), topic=science
     *
     *   With no interests, seg-better-band-fit should still rank first.
     *   Verifies no-op when interests are empty.
     */
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    let capturedSegmentIds: string[] = [];
    const insertSpy = vi
      .fn()
      .mockImplementation((rows: Array<Record<string, unknown>>) => {
        capturedSegmentIds = (rows[0]?.segment_ids as string[]) ?? [];
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...fixtureCiSessionWithInterests,
                segment_ids: capturedSegmentIds,
              },
              error: null,
            }),
          }),
        };
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
          insert: insertSpy,
        };
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileNoInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingFresherNoMatch]);
      }
      if (table === "video_segments") {
        // Band-fit winner (better) listed second to verify ranking does the job
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentBetterBandFitNoTopic],
          [fixtureSegmentTopicMatch, fixtureSegmentBetterBandFitNoTopic],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/premium/today") as never);

    // Without interest bonus, band-fit alone determines order
    // seg-better-band-fit (0.965) > seg-topic-match (0.962)
    expect(capturedSegmentIds[0]).toBe(fixtureSegmentBetterBandFitNoTopic.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: GET handler — interests_applied in assemblyMeta
// ─────────────────────────────────────────────────────────────────────────────

describe("GET handler — interests_applied field in assemblyMeta", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("HANDLER-001: assemblyMeta contains interests_applied with correct counts when user has interests", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(5);

    const ciSessionWithMeta = {
      ...fixtureCiSessionWithInterests,
      assembly_meta: {
        ...fixtureCiSessionWithInterests.assembly_meta,
        interests_applied: { topics: 2, formats: 1 },
      },
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "ci_sessions") {
        return buildCiSessionsMock(null, ciSessionWithMeta);
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileWithInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingOlderTopicMatch]);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(5);
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
          pool_band: string;
          interests_applied?: { topics: number; formats: number };
        };
      };
      remainingQuestionCap: number;
    };

    expect(body.session.assemblyMeta.status).toBe("ready");
    expect(body.session.assemblyMeta.interests_applied).toEqual({
      topics: 2,
      formats: 1,
    });
  });

  it("HANDLER-002: assemblyMeta interests_applied is { topics: 0, formats: 0 } when no interests", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    const ciSessionNoInterests = {
      ...fixtureCiSessionWithInterests,
      assembly_meta: {
        ...fixtureCiSessionWithInterests.assembly_meta,
        interests_applied: { topics: 0, formats: 0 },
      },
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "ci_sessions") {
        return buildCiSessionsMock(null, ciSessionNoInterests);
      }
      if (table === "user_vocab_profiles")
        return buildVocabProfileMock(fixtureVocabProfile);
      if (table === "users")
        return buildUsersMock(fixtureLearningProfileNoInterests);
      if (table === "reading_pieces") {
        return buildReadingPiecesMock([fixtureReadingFresherNoMatch]);
      }
      if (table === "video_segments") {
        return buildVideoSegmentsMock(
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
          [fixtureSegmentTopicMatch, fixtureSegmentNoTopicMatch],
        );
      }
      if (table === "asked_items") return buildAskedItemsMock(0);
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
          interests_applied?: { topics: number; formats: number };
        };
      };
    };

    expect(body.session.assemblyMeta.interests_applied).toEqual({
      topics: 0,
      formats: 0,
    });
  });
});
