import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  fetchTodayPremiumSession,
  fetchTodayPremiumSessionForUser,
} from "./repository";

const MATCH_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const NEWER_SESSION_ID = "22222222-2222-4222-8222-222222222222";

function premiumRow(overrides: Record<string, unknown>) {
  return {
    id: "session-id",
    slug: null,
    source_video_id: "video-1",
    source_url: "https://www.youtube.com/watch?v=video-1",
    title: "Premium session",
    subtitle: null,
    description: "A premium session",
    thumbnail_url: null,
    channel_name: "InputEnglish",
    speaker_name: "Speaker",
    source_type: "interview",
    genre: "entertainment",
    speaking_situations: ["daily-chat"],
    interest_tags: ["culture"],
    difficulty_level: 3,
    duration_seconds: 300,
    segment_start_time: 10,
    segment_end_time: 190,
    transcript: [
      {
        id: "line-1",
        text: "I had the privilege of working with this team.",
        startTime: 10,
        endTime: 14,
      },
    ],
    article: {
      title: "Article",
      subtitle: null,
      body: "A concise article body.",
      summary_bullets: [],
      reading_minutes: 2,
      reviewed: true,
    },
    delivery_analysis: [],
    roleplay: {
      title: "Roleplay",
      situation: "Project update",
      user_role: "Team lead",
      partner_role: "Manager",
      turns: [],
      target_expression_ids: [],
      analysis_reference_text: null,
      reviewed: true,
    },
    status: "published",
    reviewed: true,
    published_on: "2026-06-14",
    published_at: "2026-06-14T00:00:00.000Z",
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

function expressionCardRow(sessionId: string) {
  return {
    id: `${sessionId}-card-1`,
    session_id: sessionId,
    source_sentence_id: "line-1",
    order_index: 0,
    depth: "anchor",
    expression: "I had the privilege of",
    source_line: "I had the privilege of working with this team.",
    timestamp: "00:10",
    natural_meaning_ko: "영광스럽게도 ~할 기회가 있었다",
    story: "상대를 먼저 세우면서 내 경험을 말하는 표현이에요.",
    pronunciation: {
      stress: "privilege",
      linking: "had the가 붙어요.",
      trap_ko: "privilege를 길게 끌지 않아요.",
      ipa: "/ˈprɪvəlɪdʒ/",
      say_it_ko: "프리빌리지",
      drill: "I had the privilege of joining the team.",
    },
    variations: [
      {
        en: "I had the privilege of learning from her.",
        when_ko: "멘토에게 배운 경험을 말할 때.",
      },
    ],
    saved_atoms: {
      headword: "have the privilege of",
      one_line_nuance_ko: "기회와 상대를 먼저 세우는 표현.",
      register_ko: "격식 있는 회의와 이메일",
      examples: ["I had the privilege of leading this work."],
    },
    reviewed: true,
  };
}

function setupRepositoryClient(options: {
  userProfile: Record<string, unknown> | null;
  sessions: Record<string, unknown>[];
  articlesBySession?: Record<string, Record<string, unknown> | null>;
}) {
  const cardsBySession = Object.fromEntries(
    options.sessions.map((session) => [
      String(session.id),
      [expressionCardRow(String(session.id))],
    ]),
  );
  const articlesBySession = options.articlesBySession ?? {};

  mocks.createAdminClient.mockImplementation(() => ({
    from: vi.fn((table: string) => {
      if (table === "users") {
        const userQuery = {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: options.userProfile,
                error: null,
              }),
            })),
          })),
        };
        return userQuery;
      }

      if (table === "premium_sessions") {
        const sessionQuery = {
          select: vi.fn(() => sessionQuery),
          eq: vi.fn(() => sessionQuery),
          lte: vi.fn(() => sessionQuery),
          order: vi.fn(() => sessionQuery),
          limit: vi.fn(() => ({
            data: options.sessions,
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({
              data: options.sessions[0] ?? null,
              error: null,
            }),
          })),
        };
        return sessionQuery;
      }

      if (table === "premium_expression_cards") {
        let sessionId = "";
        const cardQuery = {
          select: vi.fn(() => cardQuery),
          eq: vi.fn((_column: string, value: string) => {
            sessionId = value;
            return cardQuery;
          }),
          order: vi.fn(() => ({
            data: cardsBySession[sessionId] ?? [],
            error: null,
          })),
        };
        return cardQuery;
      }

      if (table === "premium_articles") {
        let sessionId = "";
        const articleQuery = {
          select: vi.fn(() => articleQuery),
          eq: vi.fn((_column: string, value: string) => {
            sessionId = value;
            return articleQuery;
          }),
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: articlesBySession[sessionId] ?? null,
              error: null,
            }),
          ),
        };
        return articleQuery;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  }));
}

describe("premium repository", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
  });

  it("selects the published session that best matches the user profile", async () => {
    const sessions = [
      premiumRow({
        id: NEWER_SESSION_ID,
        title: "Late night interview",
        source_type: "talk-show",
        genre: "entertainment",
        speaking_situations: ["daily-chat"],
        interest_tags: ["culture"],
        difficulty_level: 2,
        published_on: "2026-06-14",
      }),
      premiumRow({
        id: MATCH_SESSION_ID,
        title: "Business presentation",
        source_type: "public-speech",
        genre: "business",
        speaking_situations: ["school-work", "presentation-meeting"],
        interest_tags: ["business", "leadership"],
        difficulty_level: 4,
        published_on: "2026-06-12",
      }),
    ];

    setupRepositoryClient({
      userProfile: {
        id: "user-1",
        level_band: "professional",
        goal_mode: "expression",
        focus_tags: ["business", "school-work"],
        preferred_speakers: [],
        preferred_situations: ["school-work"],
        preferred_source_types: ["public-speech"],
        preferred_genres: ["business"],
        onboarding_completed_at: "2026-06-10T00:00:00.000Z",
        updated_at: "2026-06-10T00:00:00.000Z",
      },
      sessions,
    });

    const session = await fetchTodayPremiumSessionForUser("user-1");

    expect(session?.id).toBe(MATCH_SESSION_ID);
  });

  it("hydrates the article from the premium article table when available", async () => {
    setupRepositoryClient({
      userProfile: null,
      sessions: [
        premiumRow({
          id: NEWER_SESSION_ID,
          title: "Latest session",
          article: {
            title: "Embedded article",
            body: "This compatibility JSON should not win.",
            reviewed: true,
          },
        }),
      ],
      articlesBySession: {
        [NEWER_SESSION_ID]: {
          id: "article-1",
          session_id: NEWER_SESSION_ID,
          title: "Article table title",
          subtitle: "Stored separately",
          body: "The article table is the authoritative article payload.",
          summary_bullets: ["Separate article model"],
          reading_minutes: 3,
          reviewed: true,
        },
      },
    });

    const session = await fetchTodayPremiumSession();

    expect(session?.article).toMatchObject({
      title: "Article table title",
      subtitle: "Stored separately",
      body: "The article table is the authoritative article payload.",
      summary_bullets: ["Separate article model"],
      reading_minutes: 3,
      reviewed: true,
    });
  });

  it("uses saved interest fields for curation even when goal_mode is missing", async () => {
    const sessions = [
      premiumRow({
        id: NEWER_SESSION_ID,
        title: "Latest session",
        published_on: "2026-06-14",
      }),
      premiumRow({
        id: MATCH_SESSION_ID,
        title: "Older matching session",
        source_type: "public-speech",
        genre: "business",
        speaking_situations: ["school-work"],
        published_on: "2026-06-12",
      }),
    ];

    setupRepositoryClient({
      userProfile: {
        id: "user-1",
        level_band: "professional",
        goal_mode: null,
        focus_tags: ["business"],
        preferred_speakers: [],
        preferred_situations: ["school-work"],
        preferred_source_types: ["public-speech"],
        preferred_genres: ["business"],
        onboarding_completed_at: null,
        updated_at: "2026-06-10T00:00:00.000Z",
      },
      sessions,
    });

    const session = await fetchTodayPremiumSessionForUser("user-1");

    expect(session?.id).toBe(MATCH_SESSION_ID);
  });

  it("falls back to the latest published session before any curation preferences exist", async () => {
    const sessions = [
      premiumRow({
        id: NEWER_SESSION_ID,
        title: "Latest session",
        published_on: "2026-06-14",
      }),
      premiumRow({
        id: MATCH_SESSION_ID,
        title: "Older matching session",
        source_type: "public-speech",
        genre: "business",
        speaking_situations: ["school-work"],
        published_on: "2026-06-12",
      }),
    ];

    setupRepositoryClient({
      userProfile: {
        id: "user-1",
        level_band: null,
        goal_mode: null,
        focus_tags: [],
        preferred_speakers: [],
        preferred_situations: [],
        preferred_source_types: [],
        preferred_genres: [],
        onboarding_completed_at: null,
        updated_at: "2026-06-10T00:00:00.000Z",
      },
      sessions,
    });

    const session = await fetchTodayPremiumSessionForUser("user-1");

    expect(session?.id).toBe(NEWER_SESSION_ID);
  });
});
