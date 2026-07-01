import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const fetchTodayPremiumSessionForUser = vi.fn();
const fetchPublishedPremiumSessionById = vi.fn();
const getMonthlyQuestionCount = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/lib/premium/repository", () => ({
  fetchTodayPremiumSessionForUser: (...args: unknown[]) =>
    fetchTodayPremiumSessionForUser(...args),
  fetchPublishedPremiumSessionById: (...args: unknown[]) =>
    fetchPublishedPremiumSessionById(...args),
}));

// GET /api/premium/today (SPEC-INPUT-002 Phase 3) no longer reads sessions via
// the repository helpers above — it assembles pool-based sessions directly
// through createAdminClient and getMonthlyQuestionCount. These mocks let the
// "allows trial users" test below exercise that real assembly path instead of
// hitting a live Supabase project (see src/app/api/premium/today/route.test.ts
// for the exhaustive assembly test suite this mirrors).
vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/premium/question-cap", () => ({
  getMonthlyQuestionCount: (...args: unknown[]) =>
    getMonthlyQuestionCount(...args),
  MONTHLY_QUESTION_CAP: 100,
}));

// Minimal pool-assembly fixtures for the "allows trial users" test — mirrors
// the mockFrom shape used in today/route.test.ts.
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

const fixtureSegment = {
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
};

const fixtureCiSessionRow = {
  id: "session-1",
  user_id: "user-1",
  session_date: "2026-06-15",
  reading_piece_id: "pool-reading-1",
  segment_ids: ["seg-1"],
  assembly_meta: {
    status: "ready",
    pool_band: "conversation",
    fallback_band: null,
    pool_thin: false,
    assembledAt: "2026-06-15T00:00:00.000Z",
    segmentCount: 1,
    hasReading: true,
  },
  created_at: "2026-06-15T00:00:00.000Z",
};

function setupTodayAssemblyMocks() {
  getMonthlyQuestionCount.mockResolvedValue(0);
  mockFrom.mockImplementation((table: string) => {
    if (table === "ci_sessions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: fixtureCiSessionRow, error: null }),
            }),
          }),
        }),
      };
    }

    if (table === "user_vocab_profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }

    if (table === "users") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
                        data: fixturePoolReadingPiece,
                        error: null,
                      }),
                    }),
                  }),
                }),
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: fixturePoolReadingPiece,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: fixturePoolReadingPiece,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "video_segments") {
      const chain = { data: [fixtureSegment], error: null };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(chain),
            }),
            limit: vi.fn().mockResolvedValue(chain),
          }),
          in: vi.fn().mockResolvedValue(chain),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(chain),
          }),
          limit: vi.fn().mockResolvedValue(chain),
        }),
      };
    }

    return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
  });
}

const user = { id: "user-1" };
const trialEntitlement = {
  hasAccess: true,
  plan: "FREE",
  reason: "trial",
  trialEndsAt: "2026-06-17T00:00:00.000Z",
};
const expiredEntitlement = {
  hasAccess: false,
  plan: "FREE",
  reason: "trial-expired",
  trialEndsAt: "2026-06-08T00:00:00.000Z",
};
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: "2026-06-08T00:00:00.000Z",
};

describe("premium read APIs", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    fetchTodayPremiumSessionForUser.mockReset();
    fetchPublishedPremiumSessionById.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

  it("rejects unauthenticated premium reads", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const { GET } = await import("./today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(401);
    expect(resolvePremiumEntitlement).not.toHaveBeenCalled();
  });

  it("allows trial users and disables cache", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    setupTodayAssemblyMocks();

    const { GET } = await import("./today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.session.id).toBe("session-1");
  });

  it("blocks expired free users even when the client claims premium", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { GET } = await import("./today/route");
    const response = await GET(
      new Request("http://localhost/api/premium/today", {
        headers: { "x-client-plan": "PREMIUM" },
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(402);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.entitlement.reason).toBe("trial-expired");
    expect(fetchTodayPremiumSessionForUser).not.toHaveBeenCalled();
  });

  it("gates direct session reads through the same server entitlement", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request("http://localhost/api/premium/sessions/session-1", {
        headers: { "x-client-plan": "PREMIUM" },
      }) as never,
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(402);
    expect(fetchPublishedPremiumSessionById).not.toHaveBeenCalled();
  });

  it("allows trial users to open only today's server-selected session directly", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    fetchTodayPremiumSessionForUser.mockResolvedValue({
      id: "session-today",
      title: "Today",
    });

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/premium/sessions/session-today",
      ) as never,
      { params: Promise.resolve({ sessionId: "session-today" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchTodayPremiumSessionForUser).toHaveBeenCalledWith("user-1");
    expect(fetchPublishedPremiumSessionById).not.toHaveBeenCalled();
    expect(payload.session.id).toBe("session-today");
  });

  it("blocks trial users from opening arbitrary published sessions directly", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(trialEntitlement);
    fetchTodayPremiumSessionForUser.mockResolvedValue({
      id: "session-today",
      title: "Today",
    });

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/premium/sessions/session-other",
      ) as never,
      { params: Promise.resolve({ sessionId: "session-other" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Premium session is not today's curation");
    expect(fetchPublishedPremiumSessionById).not.toHaveBeenCalled();
  });

  it("allows premium users to open any published session directly", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    fetchPublishedPremiumSessionById.mockResolvedValue({
      id: "session-other",
      title: "Published",
    });

    const { GET } = await import("./sessions/[sessionId]/route");
    const response = await GET(
      new Request(
        "http://localhost/api/premium/sessions/session-other",
      ) as never,
      { params: Promise.resolve({ sessionId: "session-other" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchTodayPremiumSessionForUser).not.toHaveBeenCalled();
    expect(fetchPublishedPremiumSessionById).toHaveBeenCalledWith(
      "session-other",
    );
    expect(payload.session.id).toBe("session-other");
  });
});
