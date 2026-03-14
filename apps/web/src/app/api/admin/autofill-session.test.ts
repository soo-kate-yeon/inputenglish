import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent,
    })),
  })),
}));

describe("POST /api/admin/autofill-session", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("normalizes professional autofill output into allowed enums", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            title: "데모로 배우는 지표 설명하는 법",
            description:
              '제품 데모 상황에서 핵심 지표를 설명하는 흐름을 연습해요. "momentum", "signal" 표현에 주목해보세요.',
            sourceType: "demo",
            speakingFunction: "explain-metric",
            roleRelevance: ["pm", "engineer", "invalid-role"],
            premiumRequired: true,
          }),
      },
    });

    const { POST } = await import("./autofill-session/route");
    const response = await POST(
      new Request("http://localhost/api/admin/autofill-session", {
        method: "POST",
        body: JSON.stringify({
          sentences: [{ id: "s1", text: "We saw strong momentum." }],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.title).toContain("지표 설명");
    expect(payload.sourceType).toBe("demo");
    expect(payload.speakingFunction).toBe("explain-metric");
    expect(payload.roleRelevance).toEqual(["pm", "engineer"]);
    expect(payload.premiumRequired).toBe(true);
  });

  it("falls back to safe defaults when AI returns invalid enums", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            title: "인터뷰로 배우는 답변하는 법",
            description: "질문에 답하는 흐름을 연습해요.",
            sourceType: "invalid-source",
            speakingFunction: "invalid-function",
            roleRelevance: ["invalid-role"],
            premiumRequired: false,
          }),
      },
    });

    const { POST } = await import("./autofill-session/route");
    const response = await POST(
      new Request("http://localhost/api/admin/autofill-session", {
        method: "POST",
        body: JSON.stringify({
          sentences: [{ id: "s1", text: "Let me walk you through it." }],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sourceType).toBe("podcast");
    expect(payload.speakingFunction).toBe("summarize");
    expect(payload.roleRelevance).toEqual(["pm"]);
    expect(payload.premiumRequired).toBe(false);
  });
});
