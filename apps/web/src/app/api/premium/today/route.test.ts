import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// Mock all dependencies before importing route
const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const getMonthlyQuestionCount = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockOrder = vi.fn();
const mockEqSegment = vi.fn();
const mockEqCiSession = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
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

const fixtureReadingPiece = {
  id: "reading-piece-1",
  level: "B1",
  format: "nonfiction",
  topic: "climate",
  body: "Climate change is a serious challenge.",
  coverage_pct: 95,
  validation_status: "approved",
  source_facts: {},
  user_id: "user-abc",
  created_at: "2026-06-15T00:00:00.000Z",
};

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
      basic: 0.1,
      conversation: 0.05,
      professional: 0.05,
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
      basic: 0.2,
      conversation: 0.05,
      professional: 0.05,
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
      basic: 0.15,
      conversation: 0.07,
      professional: 0.03,
    },
    topic_tags: ["lifestyle"],
    self_contained: true,
    difficulty_score: 2,
    created_at: "2026-06-15T00:00:00.000Z",
  },
];

const fixtureCiSessionRow = {
  id: "ci-session-1",
  user_id: "user-abc",
  session_date: "2026-06-15",
  reading_piece_id: "reading-piece-1",
  segment_ids: ["seg-1", "seg-2", "seg-3"],
  assembly_meta: { source: "assembled" },
  created_at: "2026-06-15T00:00:00.000Z",
};

function setupMockFrom({
  ciSessionRow = null,
  readingPieceRow = null,
  segments = [] as typeof fixtureSegments,
  insertResult = { data: fixtureCiSessionRow, error: null },
}: {
  ciSessionRow?: typeof fixtureCiSessionRow | null;
  readingPieceRow?: typeof fixtureReadingPiece | null;
  segments?: typeof fixtureSegments;
  insertResult?: {
    data: typeof fixtureCiSessionRow | null;
    error: null | { message: string };
  };
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "ci_sessions") {
      // For SELECT (cache check): .select().eq('session_date',...).eq('user_id',...).maybeSingle()
      // For INSERT: .insert([...]).select().maybeSingle()
      const selectChain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: ciSessionRow, error: null }),
        select: vi.fn().mockReturnThis(),
      };
      // Allow chaining: select().eq().eq().maybeSingle()
      selectChain.eq.mockReturnValue({
        eq: selectChain.eq,
        maybeSingle: selectChain.maybeSingle,
        select: selectChain.select,
      });
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
    if (table === "reading_pieces") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: readingPieceRow, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "video_segments") {
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: segments, error: null }),
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

describe("GET /api/premium/today (v1.3 session shape)", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    mockFrom.mockReset();
  });

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

  it("returns 200 with v1.3 TodaySessionResponse shape on first call (assembles new session)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(10);
    setupMockFrom({
      ciSessionRow: null, // no cached session
      readingPieceRow: fixtureReadingPiece,
      segments: fixtureSegments,
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
        assemblyMeta: Record<string, unknown>;
      };
      remainingQuestionCap: number;
    };

    expect(body.session).toBeDefined();
    expect(body.session.id).toBeDefined();
    expect(body.session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.session.readingPiece).toBeDefined();
    expect(Array.isArray(body.session.segments)).toBe(true);
    expect(body.session.assemblyMeta).toBeDefined();
    expect(typeof body.remainingQuestionCap).toBe("number");
  });

  it("returns cached session on second call (cache hit)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(20);
    setupMockFrom({
      ciSessionRow: fixtureCiSessionRow, // cached session exists
      readingPieceRow: fixtureReadingPiece,
      segments: fixtureSegments,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/premium/today") as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: { id: string; date: string };
      remainingQuestionCap: number;
    };
    expect(body.session.id).toBe("ci-session-1");
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

  it("returns readingPiece as null when no reading piece exists for user", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(0);
    setupMockFrom({
      ciSessionRow: null,
      readingPieceRow: null, // no reading piece
      segments: fixtureSegments,
      insertResult: {
        data: {
          ...fixtureCiSessionRow,
          reading_piece_id: null as unknown as string,
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
      session: { readingPiece: unknown };
    };
    expect(body.session.readingPiece).toBeNull();
  });
});
