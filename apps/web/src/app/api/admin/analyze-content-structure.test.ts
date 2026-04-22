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

describe("POST /api/admin/analyze-content-structure", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("returns one longform and 3-4 shorts within the longform range", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            longform: {
              startIndex: 10,
              endIndex: 45,
              title: "창업자 대담 핵심 구간",
              subtitle:
                "제품 철학과 팀 운영 얘기가 본격적으로 풀리는 구간이에요.",
              description:
                "창업자가 제품과 팀 얘기를 긴 호흡으로 풀어내는 구간이에요.",
              reason: "주제 응집도가 높고 몰입해서 듣기 좋은 흐름입니다.",
              speakerSummary: "제품 철학을 차분하게 설명하는 창업자",
              conversationType: "팟캐스트 인터뷰",
              topicTags: ["제품 철학", "팀 운영"],
              contentTags: ["startup", "podcast"],
              estimatedDuration: 1500,
            },
            shorts: [
              {
                startIndex: 12,
                endIndex: 14,
                title: "핵심 관점을 먼저 까는 장면",
                reason:
                  "의견을 펼치기 전에 프레임을 먼저 잡는 흐름이 선명해요.",
                learningPoints: ["관점 먼저 제시", "말문 열기"],
                patternFocus: "What I think is...",
                estimatedDuration: 45,
                difficulty: "intermediate",
              },
              {
                startIndex: 20,
                endIndex: 22,
                title: "반대 의견을 부드럽게 거는 장면",
                reason: "상대를 꺾지 않고 다른 시각을 붙이는 패턴이 좋아요.",
                learningPoints: ["완충 표현", "반대 의견"],
                patternFocus: "I would push back on that a bit",
                estimatedDuration: 40,
                difficulty: "advanced",
              },
              {
                startIndex: 30,
                endIndex: 32,
                title: "요점을 한 줄로 묶는 장면",
                reason:
                  "길게 말한 뒤 핵심을 다시 세우는 리듬을 배울 수 있어요.",
                learningPoints: ["요약", "핵심 재정리"],
                patternFocus: "The bigger point is...",
                estimatedDuration: 42,
                difficulty: "intermediate",
              },
            ],
            totalAnalyzed: 60,
          }),
      },
    });

    const { POST } = await import("./analyze-content-structure/route");
    const response = await POST(
      new Request("http://localhost/api/admin/analyze-content-structure", {
        method: "POST",
        body: JSON.stringify({
          videoTitle: "Founders Podcast",
          primarySpeakerName: "Alex",
          sentences: Array.from({ length: 60 }, (_, idx) => ({
            id: `s-${idx}`,
            text: `Sentence ${idx}`,
            startTime: idx * 30,
            endTime: idx * 30 + 20,
          })),
        }),
      }) as never,
    );

    const payload = await response.json();
    const prompt = generateContent.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(200);
    expect(payload.longform.title).toContain("핵심 구간");
    expect(payload.shorts).toHaveLength(3);
    expect(prompt).toContain("longform은 content-first");
    expect(prompt).toContain("shorts는 pattern-first");
  });
});
