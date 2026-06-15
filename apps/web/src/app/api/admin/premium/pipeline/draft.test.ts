import { beforeEach, describe, expect, it, vi } from "vitest";

const loadTranscriptWithYtDlp = vi.hoisted(() => vi.fn());

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@/lib/premium/youtube-transcript", () => ({
  loadTranscriptWithYtDlp,
}));

const transcript = [
  {
    id: "t1",
    text: "Thank you for having me here today.",
    startTime: 10,
    endTime: 14,
  },
  {
    id: "t2",
    text: "I had the privilege of serving with people who carried more than their share.",
    startTime: 130,
    endTime: 136,
  },
];

const anchorExpressionCard = {
  id: "expr-anchor-t2",
  source_sentence_id: "t2",
  order_index: 0,
  depth: "anchor" as const,
  expression: "had the privilege of",
  source_line:
    "I had the privilege of serving with people who carried more than their share.",
  timestamp: "02:10",
  natural_meaning_ko: "무언가를 할 수 있어 영광이었다는 말",
  story: "자기 성취보다 함께한 사람들을 먼저 세우는 표현입니다.",
  pronunciation: {
    stress: "privilege",
    linking: "had the를 짧게 잇습니다.",
    trap_ko: "privilege를 길게 끌지 않습니다.",
    ipa: "/ˈprɪvəlɪdʒ/",
    say_it_ko: "해드 더 프리빌리지",
    drill: "I had the privilege of serving with them.",
  },
  variations: [
    {
      en: "I had the chance to work with them.",
      when_ko: "조금 더 담백하게 말할 때",
    },
  ],
  saved_atoms: {
    headword: "privilege",
    one_line_nuance_ko: "받은 기회에 감사와 존중을 담는 단어",
    register_ko: "격식 있는 발표나 인터뷰",
    examples: ["It was a privilege to learn from her."],
  },
  reviewed: false,
};

const supportExpressionCard = {
  id: "expr-support-t2",
  source_sentence_id: "t2",
  order_index: 1,
  depth: "support" as const,
  expression: "serving with people",
  source_line:
    "I had the privilege of serving with people who carried more than their share.",
  timestamp: "02:10",
  natural_meaning_ko: "사람들과 함께 책임을 맡아 일했다는 말",
  story:
    "이 표현은 일의 중심을 한 사람에게만 두지 않고 같이 움직인 사람들에게 나눠 줍니다.",
  pronunciation: {
    stress: "serving",
    linking: "serving with를 자연스럽게 잇습니다.",
    trap_ko: "with를 길게 끌지 않습니다.",
    ipa: "/ˈsɝːvɪŋ wɪð ˈpiːpəl/",
    say_it_ko: "서빙 위드 피플",
    drill: "I was proud to serve with this group.",
  },
  variations: [],
  saved_atoms: {
    headword: "serve with",
    one_line_nuance_ko: "같은 책임 안에서 함께 움직였다는 뉘앙스",
    register_ko: "격식 있는 회고나 인터뷰",
    examples: ["I was proud to serve with this group."],
  },
  reviewed: false,
};

describe("POST /api/admin/premium/pipeline/draft", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.PREMIUM_KEY_SEGMENT_AZURE_DEPLOYMENT;
    delete process.env.PREMIUM_MODULE_AZURE_DEPLOYMENT;
    delete process.env.PREMIUM_EXPRESSION_AZURE_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.GEMINI_API_KEY;
    delete process.env.PREMIUM_KEY_SEGMENT_MODEL;
    delete process.env.PREMIUM_MODULE_MODEL;
    delete process.env.PREMIUM_EXPRESSION_MODEL;
    loadTranscriptWithYtDlp.mockReset();
  });

  it("returns one premium draft session from transcript input", async () => {
    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadTranscriptWithYtDlp).not.toHaveBeenCalled();
    expect(payload.pipeline.keySegments).toHaveLength(1);
    expect(payload.pipeline.keySegmentSource).toBe("fallback");
    expect(payload.pipeline.keySegmentProvider).toBeNull();
    expect(payload.pipeline.moduleSource).toBe("fallback");
    expect(payload.pipeline.moduleProvider).toBeNull();
    expect(payload.pipeline.expressionCardSource).toBe("fallback");
    expect(payload.pipeline.expressionCardProvider).toBeNull();
    expect(payload.pipeline.crop).toMatchObject({
      startTime: 43,
      endTime: 223,
    });
    expect(payload.session.expression_cards).toEqual([
      expect.objectContaining({
        id: "expr-anchor-t2",
        depth: "anchor",
        source_sentence_id: "t2",
        reviewed: false,
      }),
      expect.objectContaining({
        id: "expr-support-t2",
        depth: "support",
        source_sentence_id: "t2",
        variations: [],
        reviewed: false,
      }),
    ]);
    expect(payload.session.reviewed).toBe(false);
  });

  it("uses a structured AI selector for the single key segment when configured", async () => {
    process.env.AZURE_OPENAI_ENDPOINT =
      "https://inputenglish.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "azure-key";
    process.env.PREMIUM_KEY_SEGMENT_AZURE_DEPLOYMENT = "gpt-4o-segment";
    process.env.AZURE_OPENAI_API_VERSION = "2026-01-01";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "ai-segment-t1",
                title: "Opening gratitude",
                startTime: 10,
                endTime: 14,
                reason:
                  "This line opens with gratitude and gives the session a clear speaking stance.",
                transcriptLineId: "t1",
                anchorExpression: "I appreciate the chance to",
                practicalUseScore: 5,
                frequencyScore: 4,
                transferScore: 5,
                koreanLearnerValueScore: 5,
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
        }),
      }) as never,
    );
    const payload = await response.json();
    const fetchBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

    expect(response.status).toBe(200);
    expect(payload.pipeline.keySegments).toEqual([
      expect.objectContaining({
        id: "ai-segment-t1",
        startTime: 10,
        endTime: 14,
      }),
    ]);
    expect(payload.pipeline.keySegmentSource).toBe("ai");
    expect(payload.pipeline.keySegmentProvider).toBe("azure-openai");
    expect(payload.pipeline.keySegmentModel).toBe("gpt-4o-segment");
    expect(payload.pipeline.crop).toMatchObject({
      startTime: 0,
      endTime: 180,
    });
    expect(fetchBody.messages[1].content).toContain(
      "Do not return an array, multiple clips, shorts, chapters, or split suggestions.",
    );
    expect(fetchBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "premium_key_segment",
        strict: true,
        schema: expect.objectContaining({
          required: expect.arrayContaining(["id", "startTime", "endTime"]),
        }),
      },
    });
  });

  it("rejects Flash models for AI key segment selection", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.PREMIUM_KEY_SEGMENT_MODEL = "gemini-2.5-flash";

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toContain("Flash models are not allowed");
  });

  it("uses structured AI modules for article and roleplay when configured", async () => {
    process.env.AZURE_OPENAI_ENDPOINT =
      "https://inputenglish.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "azure-key";
    process.env.PREMIUM_MODULE_AZURE_DEPLOYMENT = "gpt-4o-modules";
    process.env.AZURE_OPENAI_API_VERSION = "2026-01-01";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                article: {
                  title: "AI article",
                  subtitle: "AI subtitle",
                  body: "이 장면은 감사로 시작합니다. 운영자는 이 문장이 오늘 세션의 중심인지 확인합니다.",
                  summary_bullets: ["감사로 여는 장면", "짧은 발화 연습"],
                  reading_minutes: 2,
                  reviewed: false,
                },
                roleplay: {
                  title: "AI roleplay",
                  situation: "회의에서 함께한 팀에게 공을 돌리는 상황",
                  user_role: "학습자",
                  partner_role: "동료",
                  target_expression_ids: [],
                  turns: [
                    {
                      id: "ai-coach-1",
                      speaker: "coach",
                      avatar_label: "Coach",
                      line: "How would you describe the team?",
                      translation:
                        "그 팀과 함께 일한 경험을 어떻게 설명하시겠어요?",
                      hidden: false,
                      reference_text: "",
                      expression_ids: [],
                    },
                    {
                      id: "ai-user-1",
                      speaker: "user",
                      avatar_label: "You",
                      line: "",
                      translation:
                        "더 큰 몫을 감당한 사람들과 함께할 수 있어 영광이었다고 말해보세요.",
                      hidden: true,
                      reference_text:
                        "I had the privilege of serving with people who carried more than their share.",
                      expression_ids: [],
                    },
                  ],
                  analysis_reference_text:
                    "I had the privilege of serving with people who carried more than their share.",
                  reviewed: false,
                },
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
          keySegments: [
            {
              id: "operator-segment-t2",
              title: "Privilege",
              startTime: 130,
              endTime: 136,
              reason: "operator selected",
            },
          ],
        }),
      }) as never,
    );
    const payload = await response.json();
    const fetchBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

    expect(response.status).toBe(200);
    expect(payload.pipeline.keySegmentSource).toBe("operator");
    expect(payload.pipeline.moduleSource).toBe("ai");
    expect(payload.pipeline.moduleProvider).toBe("azure-openai");
    expect(payload.pipeline.moduleModel).toBe("gpt-4o-modules");
    expect(payload.pipeline.expressionCardSource).toBe("fallback");
    expect(payload.session.expression_cards).toHaveLength(2);
    expect(payload.session.article.title).toBe("AI article");
    expect(payload.session.delivery_analysis).toEqual([]);
    expect(payload.session.roleplay.title).toBe("AI roleplay");
    expect(payload.session.roleplay.turns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ai-user-1",
          speaker: "user",
          translation:
            "더 큰 몫을 감당한 사람들과 함께할 수 있어 영광이었다고 말해보세요.",
          hidden: true,
        }),
      ]),
    );
    expect(fetchBody.messages[1].content).toContain(
      "Return one valid JSON object with article and roleplay.",
    );
    expect(fetchBody.messages[1].content).toContain(
      "Every roleplay turn must include a natural Korean translation",
    );
    expect(fetchBody.messages[1].content).toContain(
      "Premium voice rules for every generated article, translation, and roleplay line:",
    );
    expect(fetchBody.messages[1].content).toContain(
      "금지어: 효과적인, 효과적으로, 전략적으로.",
    );
    expect(fetchBody.messages[1].content).toContain(
      "켜지다 / 피어나다 / 물들다 / 스며들다 + 추상명사 조합 절대 금지.",
    );
    expect(fetchBody.messages[1].content).toContain(
      "어원이 불확실하거나 민간어원에 가까우면 생략.",
    );
    expect(fetchBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "premium_session_modules",
        strict: true,
        schema: expect.objectContaining({
          required: ["article", "roleplay"],
        }),
      },
    });
    expect(
      fetchBody.response_format.json_schema.schema.properties.roleplay
        .properties.turns.items.required,
    ).toContain("translation");
  });

  it("rejects Flash models for premium module generation", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.PREMIUM_MODULE_MODEL = "gemini-2.5-flash";

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
          keySegments: [
            {
              id: "operator-segment-t2",
              title: "Privilege",
              startTime: 130,
              endTime: 136,
              reason: "operator selected",
            },
          ],
          expressionCards: [anchorExpressionCard, supportExpressionCard],
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toContain("Flash models are not allowed");
  });

  it("rejects Flash models for premium expression cards instead of hiding them behind fallback", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.PREMIUM_EXPRESSION_MODEL = "gemini-2.5-flash";

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
          keySegments: [
            {
              id: "operator-segment-t2",
              title: "Privilege",
              startTime: 130,
              endTime: 136,
              reason: "operator selected",
            },
          ],
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toContain("Flash models are not allowed");
  });

  it("rejects AI roleplay modules without Korean turn translations", async () => {
    process.env.AZURE_OPENAI_ENDPOINT =
      "https://inputenglish.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "azure-key";
    process.env.PREMIUM_MODULE_AZURE_DEPLOYMENT = "gpt-4o-modules";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                article: {
                  title: "AI article",
                  subtitle: "AI subtitle",
                  body: "이 장면은 감사로 시작합니다.",
                  summary_bullets: ["감사로 여는 장면"],
                  reading_minutes: 2,
                  reviewed: false,
                },
                roleplay: {
                  title: "AI roleplay",
                  situation: "회의에서 함께한 팀에게 공을 돌리는 상황",
                  user_role: "학습자",
                  partner_role: "동료",
                  target_expression_ids: [],
                  turns: [
                    {
                      id: "ai-user-1",
                      speaker: "user",
                      hidden: true,
                      reference_text:
                        "I had the privilege of serving with people who carried more than their share.",
                      expression_ids: [],
                    },
                  ],
                  analysis_reference_text:
                    "I had the privilege of serving with people who carried more than their share.",
                  reviewed: false,
                },
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
          keySegments: [
            {
              id: "operator-segment-t2",
              title: "Privilege",
              startTime: 130,
              endTime: 136,
              reason: "operator selected",
            },
          ],
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toContain("Korean translations");
  });

  it("loads transcript with yt-dlp when transcript input is omitted", async () => {
    loadTranscriptWithYtDlp.mockResolvedValueOnce({
      metadata: {
        title: "Loaded from YouTube",
        channel: "Harvard",
        thumbnail: "https://img.youtube.com/vi/video-1/hqdefault.jpg",
        duration: 360,
      },
      transcript,
    });

    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadTranscriptWithYtDlp).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=video-1",
    );
    expect(payload.session.title).toBe("Loaded from YouTube");
    expect(payload.session.channel_name).toBe("Harvard");
    expect(payload.session.thumbnail_url).toBe(
      "https://img.youtube.com/vi/video-1/hqdefault.jpg",
    );
    expect(payload.session.duration_seconds).toBe(360);
    expect(payload.session.transcript).toHaveLength(1);
    expect(payload.session.transcript[0].id).toBe("t2");
  });

  it("rejects multi-segment premium drafts", async () => {
    const { POST } = await import("./draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/pipeline/draft", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
          title: "Pipeline draft",
          durationSeconds: 400,
          transcript,
          keySegments: [
            {
              id: "a",
              title: "A",
              startTime: 10,
              endTime: 14,
              reason: "first",
            },
            {
              id: "b",
              title: "B",
              startTime: 130,
              endTime: 136,
              reason: "second",
            },
          ],
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toContain("exactly one key segment");
  });
});
