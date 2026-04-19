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

describe("POST /api/admin/analyze-scenes", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("uses situation-focused curation criteria in the prompt and returns 3 scenes", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            scenes: [
              {
                startIndex: 0,
                endIndex: 2,
                title: "지표를 해석하며 업데이트하는 장면",
                reason:
                  "숫자 변화의 의미를 설명하는 흐름이 분명해서 실무 세션으로 만들기 좋습니다.",
                learningPoints: [
                  "지표 설명 구조",
                  "업데이트 말하기 톤",
                  "숫자 뒤 의미 덧붙이기",
                ],
                estimatedDuration: 42,
              },
              {
                startIndex: 3,
                endIndex: 5,
                title: "질문에 맥락을 붙여 답하는 장면",
                reason:
                  "Q&A 상황에서 바로 답하지 않고 맥락을 먼저 주는 답변 패턴을 연습할 수 있습니다.",
                learningPoints: [
                  "질문 답변 구조",
                  "맥락 먼저 제시",
                  "짧고 차분한 톤",
                ],
                estimatedDuration: 39,
              },
              {
                startIndex: 6,
                endIndex: 8,
                title: "다음 액션을 제안하는 장면",
                reason:
                  "상대에게 다음 흐름을 제안하고 대화를 앞으로 밀어가는 패턴을 연습하기 좋습니다.",
                learningPoints: [
                  "제안하기",
                  "다음 행동 제시",
                  "설득력 있는 마무리",
                ],
                estimatedDuration: 51,
              },
            ],
            totalAnalyzed: 9,
          }),
      },
    });

    const { POST } = await import("./analyze-scenes/route");
    const response = await POST(
      new Request("http://localhost/api/admin/analyze-scenes", {
        method: "POST",
        body: JSON.stringify({
          sentences: Array.from({ length: 9 }, (_, idx) => ({
            id: `s-${idx}`,
            text: `Sentence ${idx}`,
            startTime: idx * 10,
            endTime: idx * 10 + 8,
          })),
        }),
      }) as never,
    );

    const payload = await response.json();
    const prompt = generateContent.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(200);
    expect(payload.scenes).toHaveLength(3);
    expect(prompt).toContain("상황 재사용성");
    expect(prompt).toContain("독립 세션 가능성");
    expect(prompt).toContain("maximize learning payoff and situation variety");
  });
});
