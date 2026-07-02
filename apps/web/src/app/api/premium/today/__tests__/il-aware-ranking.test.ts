/**
 * SPEC-WEB-001 Phase 5 — Task 5.1: IL-aware segment ranking within the
 * (currently single) course lane, plus EC-005-A (empty grid cell must not
 * expose a fabricated/wrong-difficulty session).
 *
 * rankAndSliceSegments already ranks by band-fit + optional interest bonus
 * (SPEC-INPUT-002/003). This phase adds an IL-proximity signal: when the
 * caller supplies a userIl, segments whose `il` field is closer to userIl
 * should rank higher, without overriding band-fit as the primary filter
 * (mirrors the existing +0.1 interest-bonus pattern — additive, capped).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VideoSegment } from "@inputenglish/shared";

// ── Mocks (mirrors today/route.phase4-i-u2.test.ts pattern) ───────────────────

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

function seg(
  id: string,
  il: number | null,
  coverage: Record<string, number>,
): Record<string, unknown> {
  return {
    id,
    parent_video_id: `yt-${id}`,
    channel_id: `ch-${id}`,
    start_time: 0,
    end_time: 60,
    transcript: [],
    wpm: 150,
    band_coverage: coverage,
    topic_tags: [],
    self_contained: true,
    difficulty_score: 3,
    il,
    created_at: "2026-07-01T00:00:00.000Z",
  };
}

const COVERAGE = {
  beginner: 0.9,
  basic: 0.94,
  conversation: 0.965,
  professional: 0.97,
};

describe("today/route — Task 5.1 IL-aware segment ranking (unit, via rankAndSliceSegments export)", () => {
  it("ranks segments closer to the user's il_index higher when band-fit scores are tied", async () => {
    const { rankAndSliceSegments } = await import("../route");

    const segments: VideoSegment[] = [
      seg("far", 6.5, COVERAGE),
      seg("close", 4.1, COVERAGE),
      seg("mid", 5.0, COVERAGE),
    ].map((r) => ({
      id: String(r.id),
      parentVideoId: String(r.parent_video_id),
      channelId: String(r.channel_id),
      startTime: 0,
      endTime: 60,
      transcript: [],
      wpm: 150,
      bandCoverage: r.band_coverage as Record<string, number> as never,
      topicTags: [],
      selfContained: true,
      difficultyScore: 3,
      createdAt: "2026-07-01T00:00:00.000Z",
      il: r.il as number | null,
    })) as unknown as VideoSegment[];

    const ranked = rankAndSliceSegments(segments, "conversation", 1, [], 4.0);
    expect(ranked[0].id).toBe("close");
  });
});

describe("GET /api/premium/today — Task 5.1 EC-005-A (empty IL-filtered lane -> preparing, not mismatched content)", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("returns a preparing session (not a wrong-difficulty session) when no segments/reading exist for the user's band at all", async () => {
    requireApiUser.mockResolvedValue({ id: "user-il-1" });
    resolvePremiumEntitlement.mockResolvedValue({
      hasAccess: true,
      plan: "PREMIUM",
      reason: "premium",
      trialEndsAt: null,
    });
    getMonthlyQuestionCount.mockResolvedValue(0);

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
          insert: vi.fn(),
        };
      }
      if (table === "user_vocab_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "user-il-1",
                  level_band: "professional",
                  il_index: 7.0,
                  selected_course: "news",
                  focus_tags: [],
                },
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
                      limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
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
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: { assemblyMeta: { status: string }; segments: unknown[] };
    };
    expect(body.session.assemblyMeta.status).toBe("preparing");
    expect(body.session.segments).toEqual([]);
  });
});
