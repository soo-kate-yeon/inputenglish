import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent,
    })),
  })),
}));

describe("POST /api/admin/autofill-longform", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("returns longform copy and tags without pattern-first framing", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            title: "창업자 철학 대담",
            subtitle:
              "제품을 왜 이렇게 만드는지 긴 호흡으로 풀어가는 구간이에요.",
            description:
              "창업자가 제품 철학과 팀 운영 얘기를 한 흐름으로 이어가는 구간이에요. 짧은 표현보다 긴 설명의 구조를 듣는 재미가 살아 있어요.",
            speakerSummary: "차분하게 철학을 설명하는 창업자",
            talkSummary: "팟캐스트 인터뷰 형식의 창업자 대담",
            topicTags: ["제품 철학", "팀 운영"],
            contentTags: ["podcast", "startup"],
          }),
      },
    });

    const { POST } = await import("./autofill-longform/route");
    const response = await POST(
      new Request("http://localhost/api/admin/autofill-longform", {
        method: "POST",
        body: JSON.stringify({
          videoTitle: "Founders Podcast",
          primarySpeakerName: "Alex",
          sentences: [
            { id: "s1", text: "We care deeply about how people use it." },
          ],
        }),
      }) as never,
    );

    const payload = await response.json();
    const prompt = generateContent.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(200);
    expect(payload.title).toContain("대담");
    expect(payload.topicTags).toEqual(["제품 철학", "팀 운영"]);
    expect(prompt).toContain("pattern-first 금지");
    expect(prompt).toContain("content-first");
  });
});
