/**
 * TDD Phase 4 — REQ-VOCAB-I I-U2: resolveUserBand real-data regression test.
 *
 * Verifies that when user_vocab_profiles.estimated_band exists (Priority 1),
 * today route uses it — and that today/route.ts source is UNCHANGED by Phase 4.
 *
 * Mock pattern mirrors today/route.test.ts exactly.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks (same as today/route.test.ts) ───────────────────────────────────────

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

// ── Fixtures ───────────────────────────────────────────────────────────────────

const user = { id: "user-abc" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};

// Priority 1: vocab profile with estimated_band = 'professional'
const fixtureVocabProfileProfessional = {
  user_id: "user-abc",
  estimated_band: "professional",
};

// Priority 2: learning profile with level_band = 'basic' (must NOT win)
const fixtureLearningProfileBasic = {
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

const fixturePoolReadingProfessional = {
  id: "pool-reading-professional",
  level: "C1",
  format: "nonfiction",
  topic: "finance",
  body: "Advanced financial concepts are widely discussed.",
  coverage_pct: 92,
  validation_status: "approved",
  source_facts: {},
  user_id: null,
  band: "professional",
  expires_at: null,
  created_at: "2026-06-16T00:00:00.000Z",
};

const fixtureSegmentsProfessional = [
  {
    id: "seg-pro-1",
    parent_video_id: "yt-pro",
    channel_id: "ch-pro",
    start_time: 0,
    end_time: 60,
    transcript: [],
    wpm: 160,
    band_coverage: {
      beginner: 0.9,
      basic: 0.95,
      conversation: 0.97,
      professional: 0.99,
    },
    topic_tags: ["finance"],
    self_contained: true,
    difficulty_score: 4,
    created_at: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "seg-pro-2",
    parent_video_id: "yt-pro",
    channel_id: "ch-pro",
    start_time: 70,
    end_time: 130,
    transcript: [],
    wpm: 155,
    band_coverage: {
      beginner: 0.88,
      basic: 0.93,
      conversation: 0.96,
      professional: 0.98,
    },
    topic_tags: ["economy"],
    self_contained: true,
    difficulty_score: 4,
    created_at: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "seg-pro-3",
    parent_video_id: "yt-pro",
    channel_id: "ch-pro",
    start_time: 140,
    end_time: 200,
    transcript: [],
    wpm: 150,
    band_coverage: {
      beginner: 0.85,
      basic: 0.91,
      conversation: 0.95,
      professional: 0.97,
    },
    topic_tags: ["business"],
    self_contained: true,
    difficulty_score: 3,
    created_at: "2026-06-16T00:00:00.000Z",
  },
];

const fixtureCiSessionProfessional = {
  id: "ci-session-pro-1",
  user_id: "user-abc",
  session_date: "2026-06-16",
  reading_piece_id: "pool-reading-professional",
  segment_ids: ["seg-pro-1", "seg-pro-2", "seg-pro-3"],
  assembly_meta: {
    status: "ready",
    pool_band: "professional",
    fallback_band: null,
    pool_thin: false,
    assembledAt: "2026-06-16T00:00:00.000Z",
    segmentCount: 3,
    hasReading: true,
  },
  created_at: "2026-06-16T00:00:00.000Z",
};

function setupMockFromProfessional() {
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: fixtureCiSessionProfessional,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "user_vocab_profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: fixtureVocabProfileProfessional,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "users") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: fixtureLearningProfileBasic,
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
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: fixturePoolReadingProfessional,
                        error: null,
                      }),
                    }),
                  }),
                }),
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: fixturePoolReadingProfessional,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: fixturePoolReadingProfessional,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "video_segments") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: fixtureSegmentsProfessional,
                error: null,
              }),
            }),
            limit: vi.fn().mockResolvedValue({
              data: fixtureSegmentsProfessional,
              error: null,
            }),
          }),
          in: vi.fn().mockResolvedValue({
            data: fixtureSegmentsProfessional,
            error: null,
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: fixtureSegmentsProfessional,
              error: null,
            }),
          }),
          limit: vi.fn().mockResolvedValue({
            data: fixtureSegmentsProfessional,
            error: null,
          }),
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite: I-U2 regression
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/premium/today — I-U2 resolveUserBand real-data regression (Phase 4)", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("I-U2: uses estimated_band='professional' (Priority 1) over level_band='basic' (Priority 2)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);
    setupMockFromProfessional();

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: {
        assemblyMeta: { pool_band: string };
      };
    };

    // pool_band reveals which band resolveUserBand returned.
    // With estimated_band='professional' in vocab profile, Priority 1 must win.
    expect(body.session.assemblyMeta.pool_band).toBe("professional");
  });

  it("I-U2: today/route.ts source file is UNCHANGED by Phase 4 — no fetchKnownLemmas import", () => {
    const webRoot = path.resolve(__dirname, "../../../.."); // apps/web/src/app/api/premium/today → apps/web/src
    const todayRouteSource = readFileSync(
      path.join(webRoot, "app/api/premium/today/route.ts"),
      "utf8",
    );

    // today/route.ts must NOT reference fetchKnownLemmas
    expect(todayRouteSource).not.toContain("fetchKnownLemmas");
    // Must still contain the resolveUserBand Priority 1 logic (these identifiers must be present)
    expect(todayRouteSource).toContain("user_vocab_profiles");
    expect(todayRouteSource).toContain("estimated_band");
  });

  it("I-U2: when estimated_band is null (no profile), falls back to level_band (Priority 2)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);

    // Vocab profile row exists but estimated_band is null
    const vocabProfileNullBand = { user_id: "user-abc", estimated_band: null };

    // Pool reading and segments for 'basic' band
    const basicPoolReading = {
      ...fixturePoolReadingProfessional,
      id: "pool-basic-1",
      band: "basic",
    };
    const basicCiSession = {
      ...fixtureCiSessionProfessional,
      id: "ci-basic-1",
      reading_piece_id: "pool-basic-1",
      assembly_meta: {
        ...fixtureCiSessionProfessional.assembly_meta,
        pool_band: "basic",
      },
    };

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
              maybeSingle: vi.fn().mockResolvedValue({
                data: basicCiSession,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "user_vocab_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: vocabProfileNullBand,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: fixtureLearningProfileBasic,
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
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: basicPoolReading,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: basicPoolReading,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: basicPoolReading,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "video_segments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: fixtureSegmentsProfessional,
                  error: null,
                }),
              }),
              limit: vi.fn().mockResolvedValue({
                data: fixtureSegmentsProfessional,
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: fixtureSegmentsProfessional,
              error: null,
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: fixtureSegmentsProfessional,
                error: null,
              }),
            }),
            limit: vi.fn().mockResolvedValue({
              data: fixtureSegmentsProfessional,
              error: null,
            }),
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
      session: { assemblyMeta: { pool_band: string } };
    };

    // Priority 1 is null → falls back to Priority 2 (level_band='basic')
    expect(body.session.assemblyMeta.pool_band).toBe("basic");
  });
});
