import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent,
    })),
  })),
}));

describe("POST /api/admin/generate-session-context", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("returns normalized session context for admin authoring", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            reusable_scenarios: [" 주간 지표 공유 ", "", "프로젝트 리뷰"],
            key_vocabulary: [" momentum ", "signal", ""],
            grammar_rhetoric_note: " 관찰 기반 표현을 유지한다. ",
            expected_takeaway: " 숫자 변화의 의미를 차분하게 설명할 수 있다. ",
          }),
      },
    });

    const { POST } = await import("./generate-session-context/route");
    const response = await POST(
      new Request("http://localhost/api/admin/generate-session-context", {
        method: "POST",
        body: JSON.stringify({
          title: "데모로 배우는 지표 설명하는 법",
          description: "지표 설명을 연습해요.",
          sentences: [{ id: "s1", text: "We saw strong momentum." }],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.context.reusable_scenarios).toEqual([
      "주간 지표 공유",
      "프로젝트 리뷰",
    ]);
    expect(payload.context.key_vocabulary).toEqual(["momentum", "signal"]);
    expect(payload.context.expected_takeaway).toBe(
      "숫자 변화의 의미를 차분하게 설명할 수 있다.",
    );
    expect(payload.context.generated_by).toBe("gemini");
  });
});
