import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPremiumDailyCurationPush = vi.hoisted(() => vi.fn());
const sessionUpsertSingle = vi.fn();
const articleUpsert = vi.fn();
const articleMaybeSingle = vi.fn();
const cardDeleteEq = vi.fn();
const cardInsert = vi.fn();
const sessionMaybeSingle = vi.fn();
const cardOrder = vi.fn();
const sessionUpdateEq = vi.fn();

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@/lib/premium/push-notifications", () => ({
  sendPremiumDailyCurationPush,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "premium_sessions") {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: sessionUpsertSingle,
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: sessionMaybeSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: sessionUpdateEq,
          })),
        };
      }

      if (table === "premium_articles") {
        return {
          upsert: articleUpsert,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: articleMaybeSingle,
            })),
          })),
        };
      }

      if (table === "premium_expression_cards") {
        return {
          delete: vi.fn(() => ({
            eq: cardDeleteEq,
          })),
          insert: cardInsert,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: cardOrder,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  })),
}));

const validCard = {
  depth: "anchor",
  expression: "I had the privilege of",
  source_line: "I had the privilege of working with this team.",
  timestamp: "00:05",
  natural_meaning_ko: "영광스럽게도 ~할 기회가 있었다",
  story: "그가 자기를 한껏 낮춘 거예요.",
  pronunciation: {
    stress: "privilege",
    linking: "had the가 붙어요.",
    trap_ko: "너무 또박또박 읽지 마세요.",
    ipa: "/ˈprɪvəlɪdʒ/",
    say_it_ko: "프리빌리지 → **프리**빌리졉",
    drill: "I had the privilege of joining the team.",
  },
  variations: [],
  saved_atoms: {
    headword: "have the privilege of",
    one_line_nuance_ko: "기회와 상대를 먼저 세우는 표현.",
    register_ko: "격식 있는 회의와 이메일",
    examples: ["I had the privilege of leading this work."],
  },
  reviewed: true,
};

const validSupportCard = {
  depth: "support",
  expression: "working with this team",
  source_line: "I had the privilege of working with this team.",
  timestamp: "00:05",
  natural_meaning_ko: "이 팀과 함께 일하면서",
  story:
    "이 말은 주인공을 자기 혼자에게 두지 않고, 같이 만든 사람들에게 돌려놓는 방식이에요.",
  pronunciation: {
    stress: "working, team",
    linking: "working with가 가볍게 이어져요.",
    trap_ko: "with를 길게 끌지 마세요.",
    ipa: "/ˈwɝːkɪŋ wɪð ðɪs tiːm/",
    say_it_ko: "워킹 위드 디스 팀",
    drill: "I learned a lot working with this team.",
  },
  variations: [],
  saved_atoms: {
    headword: "work with",
    one_line_nuance_ko: "사람들과 함께 맞춰가며 일했다는 결.",
    register_ko: "일상적인 회의와 회고",
    examples: ["I enjoyed working with this team."],
  },
  reviewed: true,
};

const validDraft = {
  source_video_id: "video-1",
  source_url: "https://www.youtube.com/watch?v=video-1",
  title: "Premium draft",
  duration_seconds: 300,
  segment_start_time: 0,
  segment_end_time: 300,
  transcript: [
    {
      id: "s1",
      text: "I had the privilege of working with this team.",
      startTime: 0,
      endTime: 5,
    },
  ],
  article: {
    title: "Article",
    body: "A short article body.",
    reviewed: true,
  },
  delivery_analysis: [
    {
      id: "d1",
      line_id: "s1",
      intonation_note: "A steady drop on privilege.",
      style_note: "Credits the team before the speaker.",
      coaching_note: "Keep privilege compact.",
      reviewed: true,
    },
  ],
  roleplay: {
    title: "Roleplay",
    situation: "Meeting",
    user_role: "Lead",
    partner_role: "Coach",
    target_expression_ids: [],
    turns: [
      {
        id: "r1",
        speaker: "user",
        translation: "이 팀과 함께 일할 수 있어 영광이었다고 말해보세요.",
        reference_text: "I had the privilege of working with this team.",
      },
    ],
    reviewed: true,
  },
  expression_cards: [validCard, validSupportCard],
  reviewed: true,
};

describe("premium session admin routes", () => {
  beforeEach(() => {
    sessionUpsertSingle.mockReset();
    articleUpsert.mockReset();
    articleMaybeSingle.mockReset();
    cardDeleteEq.mockReset();
    cardInsert.mockReset();
    sessionMaybeSingle.mockReset();
    cardOrder.mockReset();
    sessionUpdateEq.mockReset();
    sendPremiumDailyCurationPush.mockReset();
    articleUpsert.mockResolvedValue({ error: null });
    articleMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("saves a premium draft and replaces expression cards", async () => {
    sessionUpsertSingle.mockResolvedValue({
      data: { id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    cardDeleteEq.mockResolvedValue({ error: null });
    cardInsert.mockResolvedValue({ error: null });

    const { POST } = await import("./sessions/draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/sessions/draft", {
        method: "POST",
        body: JSON.stringify({ session: validDraft }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.articleSaved).toBe(true);
    expect(articleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "11111111-1111-4111-8111-111111111111",
        title: "Article",
        body: "A short article body.",
        reviewed: true,
      }),
      { onConflict: "session_id" },
    );
    expect(cardInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          session_id: "11111111-1111-4111-8111-111111111111",
          expression: "I had the privilege of",
        }),
      ]),
    );
  });

  it("blocks publishing incomplete sessions", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        source_video_id: "video-1",
        source_url: "https://www.youtube.com/watch?v=video-1",
        title: "Incomplete",
        duration_seconds: 300,
        segment_start_time: 0,
        segment_end_time: 300,
        transcript: [],
        article: { title: "Article", body: "Body" },
        delivery_analysis: [],
        roleplay: {
          title: "Roleplay",
          situation: "Meeting",
          user_role: "Lead",
          partner_role: "Coach",
          target_expression_ids: [],
          turns: [],
          reviewed: false,
        },
        reviewed: false,
      },
      error: null,
    });
    cardOrder.mockResolvedValue({ data: [], error: null });

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.issues).toContain("transcript is empty");
    expect(sessionUpdateEq).not.toHaveBeenCalled();
  });

  it("blocks publishing reviewed sessions with broken generated module references", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        ...validDraft,
        delivery_analysis: [
          {
            ...validDraft.delivery_analysis[0],
            line_id: "missing-line",
          },
        ],
      },
      error: null,
    });
    cardOrder.mockResolvedValue({
      data: [
        {
          id: "card-1",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "missing-line",
          order_index: 0,
          ...validCard,
        },
      ],
      error: null,
    });

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        "delivery analysis d1 line_id is not in transcript",
        "expression card I had the privilege of source_sentence_id is not in transcript",
      ]),
    );
    expect(sessionUpdateEq).not.toHaveBeenCalled();
  });

  it("uses the premium article table when checking publish readiness", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        ...validDraft,
      },
      error: null,
    });
    articleMaybeSingle.mockResolvedValue({
      data: {
        id: "article-1",
        session_id: "11111111-1111-4111-8111-111111111111",
        title: "Article table row",
        subtitle: null,
        body: "A reviewed-looking body that still needs table review.",
        summary_bullets: [],
        reading_minutes: 2,
        reviewed: false,
      },
      error: null,
    });
    cardOrder.mockResolvedValue({
      data: [
        {
          id: "card-1",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 0,
          ...validCard,
        },
      ],
      error: null,
    });

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.issues).toContain("article is not reviewed");
    expect(sessionUpdateEq).not.toHaveBeenCalled();
  });

  it("blocks publishing reviewed sessions without support expression cards", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        ...validDraft,
      },
      error: null,
    });
    cardOrder.mockResolvedValue({
      data: [
        {
          id: "card-1",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 0,
          ...validCard,
        },
      ],
      error: null,
    });

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.issues).toContain(
      "at least one support expression card is required",
    );
    expect(sessionUpdateEq).not.toHaveBeenCalled();
  });

  it("blocks publishing support cards that bypass draft schema constraints", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        ...validDraft,
      },
      error: null,
    });
    cardOrder.mockResolvedValue({
      data: [
        {
          id: "card-1",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 0,
          ...validCard,
        },
        {
          id: "card-2",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 1,
          ...validSupportCard,
          story: ["첫 문단.", "둘째 문단.", "셋째 문단."].join("\n\n"),
          variations: [
            {
              en: "I enjoyed working with this team.",
              when_ko: "팀 경험을 좋게 말할 때.",
            },
          ],
        },
      ],
      error: null,
    });

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        "support expression card working with this team must not include variations",
        "support expression card working with this team story must be 1-2 paragraphs",
      ]),
    );
    expect(sessionUpdateEq).not.toHaveBeenCalled();
  });

  it("publishes a reviewed premium session and sends the daily curation push", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        ...validDraft,
      },
      error: null,
    });
    cardOrder.mockResolvedValue({
      data: [
        {
          id: "card-1",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 0,
          ...validCard,
        },
        {
          id: "card-2",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 1,
          ...validSupportCard,
        },
      ],
      error: null,
    });
    sessionUpdateEq.mockResolvedValue({ error: null });
    sendPremiumDailyCurationPush.mockResolvedValue({
      sent: 2,
      tickets: [{ status: "ok" }],
    });

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(sessionUpdateEq).toHaveBeenCalledWith(
      "id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(sendPremiumDailyCurationPush).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Premium draft",
      description: null,
    });
    expect(payload.pushNotification).toEqual({ sent: 2 });
  });

  it("keeps publish successful when daily push delivery fails", async () => {
    sessionMaybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        ...validDraft,
      },
      error: null,
    });
    cardOrder.mockResolvedValue({
      data: [
        {
          id: "card-1",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 0,
          ...validCard,
        },
        {
          id: "card-2",
          session_id: "11111111-1111-4111-8111-111111111111",
          source_sentence_id: "s1",
          order_index: 1,
          ...validSupportCard,
        },
      ],
      error: null,
    });
    sessionUpdateEq.mockResolvedValue({ error: null });
    sendPremiumDailyCurationPush.mockRejectedValue(new Error("Expo down"));

    const { POST } = await import("./sessions/[sessionId]/publish/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/premium/sessions/11111111-1111-4111-8111-111111111111/publish",
        {
          method: "POST",
          body: JSON.stringify({ publishedOn: "2026-06-14" }),
        },
      ) as never,
      {
        params: Promise.resolve({
          sessionId: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pushNotification).toEqual({
      sent: 0,
      skipped: "send-failed",
    });
  });
});
