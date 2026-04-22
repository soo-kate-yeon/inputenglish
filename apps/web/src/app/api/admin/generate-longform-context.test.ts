import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent,
    })),
  })),
}));

describe("POST /api/admin/generate-longform-context", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("returns normalized longform context", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            speaker_snapshot: "차분하게 철학을 설명하는 창업자",
            conversation_type: "팟캐스트 인터뷰",
            core_topics: ["제품 철학", "팀 운영"],
            why_this_segment: "화자의 관점이 가장 잘 연결되는 구간이에요.",
            listening_takeaway:
              "긴 답변을 구조적으로 듣는 감각을 잡을 수 있어요.",
          }),
      },
    });

    const { POST } = await import("./generate-longform-context/route");
    const response = await POST(
      new Request("http://localhost/api/admin/generate-longform-context", {
        method: "POST",
        body: JSON.stringify({
          title: "창업자 철학 대담",
          description: "긴 호흡으로 철학을 푸는 구간",
          primarySpeakerName: "Alex",
          sentences: [{ id: "s1", text: "We care deeply about craft." }],
        }),
      }) as never,
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.context.conversation_type).toBe("팟캐스트 인터뷰");
    expect(payload.context.generated_by).toBe("gemini");
  });
});
