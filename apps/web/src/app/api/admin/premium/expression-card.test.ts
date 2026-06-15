import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent, getGenerativeModel, GoogleGenerativeAIMock } =
  vi.hoisted(() => ({
    generateContent: vi.fn(),
    getGenerativeModel: vi.fn(),
    GoogleGenerativeAIMock: vi.fn(),
  }));

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@google/generative-ai", () => ({
  SchemaType: {
    STRING: "string",
    NUMBER: "number",
    INTEGER: "integer",
    BOOLEAN: "boolean",
    ARRAY: "array",
    OBJECT: "object",
  },
  GoogleGenerativeAI: GoogleGenerativeAIMock,
}));

const requestBody = {
  expression: "I had the privilege of",
  sourceLine: "I had the privilege of working with this team.",
  timestamp: "00:05",
  speaker: "Jonny Kim",
  videoContext: "The speaker gives credit to the people around him.",
  transcriptExcerpt: "I had the privilege of working with this team.",
  userProfile: "회의와 이메일에서 격 있게 공을 돌리고 싶은 직장인",
  depth: "anchor",
};

describe("POST /api/admin/premium/expression-card", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.PREMIUM_EXPRESSION_MODEL;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.PREMIUM_EXPRESSION_AZURE_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    generateContent.mockReset();
    getGenerativeModel.mockReset();
    getGenerativeModel.mockImplementation(() => ({ generateContent }));
    GoogleGenerativeAIMock.mockReset();
    GoogleGenerativeAIMock.mockImplementation(() => ({ getGenerativeModel }));
  });

  it("rejects malformed AI JSON", async () => {
    generateContent.mockResolvedValueOnce({
      response: {
        text: () => "not json",
      },
    });

    const { POST } = await import("./expression-card/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/expression-card", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBeTruthy();
  });

  it("uses the storytelling prompt builder", async () => {
    generateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
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
          }),
      },
    });

    const { POST } = await import("./expression-card/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/expression-card", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }) as never,
    );
    const payload = await response.json();
    const prompt = generateContent.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(200);
    expect(payload.card.expression).toBe("I had the privilege of");
    expect(prompt).toContain("프리미엄 영어 학습앱 인풋영어의 수석 에디터");
    expect(prompt).toContain("depth:              anchor");
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-pro",
        generationConfig: expect.objectContaining({
          responseMimeType: "application/json",
          responseSchema: expect.objectContaining({
            type: "object",
            required: expect.arrayContaining(["expression", "pronunciation"]),
          }),
        }),
      }),
    );
    expect(payload.meta.provider).toBe("gemini");
    expect(payload.meta.model).not.toContain("flash");
  });

  it("rejects Flash models even when configured by environment", async () => {
    process.env.PREMIUM_EXPRESSION_MODEL = "gemini-2.5-flash";

    const { POST } = await import("./expression-card/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/expression-card", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("Flash models are not allowed");
    expect(getGenerativeModel).not.toHaveBeenCalled();
  });

  it("prefers Azure OpenAI for premium expression generation when configured", async () => {
    process.env.AZURE_OPENAI_ENDPOINT =
      "https://inputenglish.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "azure-key";
    process.env.PREMIUM_EXPRESSION_AZURE_DEPLOYMENT = "gpt-4o-premium";
    process.env.AZURE_OPENAI_API_VERSION = "2026-01-01";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                expression: "I had the privilege of",
                source_line: "I had the privilege of working with this team.",
                timestamp: "00:05",
                natural_meaning_ko: "영광스럽게도 ~할 기회가 있었다",
                story: "자기 공을 앞세우지 않고 팀을 먼저 세우는 문장이에요.",
                pronunciation: {
                  stress: "privilege",
                  linking: "had the가 붙어요.",
                  trap_ko: "privilege를 길게 끌지 않아요.",
                  ipa: "/ˈprɪvəlɪdʒ/",
                  say_it_ko: "프리빌리지",
                  drill: "I had the privilege of joining the team.",
                },
                variations: [],
                saved_atoms: {
                  headword: "have the privilege of",
                  one_line_nuance_ko: "기회와 상대를 먼저 세우는 표현.",
                  register_ko: "격식 있는 회의와 이메일",
                  examples: ["I had the privilege of leading this work."],
                },
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./expression-card/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/expression-card", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }) as never,
    );
    const payload = await response.json();
    const fetchBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://inputenglish.openai.azure.com/openai/deployments/gpt-4o-premium/chat/completions?api-version=2026-01-01",
    );
    expect(fetchBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "premium_expression_card",
        strict: true,
        schema: expect.objectContaining({
          required: expect.arrayContaining(["expression", "pronunciation"]),
        }),
      },
    });
    expect(fetchBody.messages[1].content).toContain(
      "depth:              anchor",
    );
    expect(getGenerativeModel).not.toHaveBeenCalled();
    expect(payload.meta).toMatchObject({
      provider: "azure-openai",
      model: "gpt-4o-premium",
    });
  });
});
