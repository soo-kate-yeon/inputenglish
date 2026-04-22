import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const getGenerativeModel = vi.fn(() => ({
  generateContent,
}));

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel,
  })),
}));

describe("POST /api/admin/translate", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
    getGenerativeModel.mockClear();
  });

  it("returns translations from a plain JSON array response", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify(["안녕하세요?", "좋은 흐름이 보이고 있어요."]),
      },
    });

    const { POST } = await import("./translate/route");
    const response = await POST(
      new Request("http://localhost/api/admin/translate", {
        method: "POST",
        body: JSON.stringify({
          sentences: ["How are you?", "We are seeing strong momentum."],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.translations).toEqual([
      "안녕하세요?",
      "좋은 흐름이 보이고 있어요.",
    ]);
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          responseMimeType: "application/json",
        }),
      }),
    );
  });

  it("extracts translations from fenced markdown JSON", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          '```json\n["오늘 어때요?", "전 부문에서 탄력이 붙고 있어요."]\n```',
      },
    });

    const { POST } = await import("./translate/route");
    const response = await POST(
      new Request("http://localhost/api/admin/translate", {
        method: "POST",
        body: JSON.stringify({
          sentences: ["How are you doing today?", "We are seeing momentum."],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.translations).toEqual([
      "오늘 어때요?",
      "전 부문에서 탄력이 붙고 있어요.",
    ]);
  });

  it("splits large translation requests into multiple batches", async () => {
    generateContent
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify(
              Array.from({ length: 12 }, (_, index) => `번역 ${index + 1}`),
            ),
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(["번역 13"]),
        },
      });

    const { POST } = await import("./translate/route");
    const response = await POST(
      new Request("http://localhost/api/admin/translate", {
        method: "POST",
        body: JSON.stringify({
          sentences: Array.from(
            { length: 13 },
            (_, index) => `Sentence ${index + 1}`,
          ),
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(payload.translations).toHaveLength(13);
    expect(payload.meta.batchCount).toBe(2);
  });

  it("falls back to smaller chunks when a large batch aborts", async () => {
    const abortError = new Error("This operation was aborted");
    abortError.name = "AbortError";

    generateContent
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify(["하나", "둘", "셋", "넷", "다섯", "여섯"]),
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify(["일곱", "여덟", "아홉", "열", "열하나", "열둘"]),
        },
      });

    const { POST } = await import("./translate/route");
    const response = await POST(
      new Request("http://localhost/api/admin/translate", {
        method: "POST",
        body: JSON.stringify({
          sentences: Array.from(
            { length: 12 },
            (_, index) => `Sentence ${index + 1}`,
          ),
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(payload.translations).toEqual([
      "하나",
      "둘",
      "셋",
      "넷",
      "다섯",
      "여섯",
      "일곱",
      "여덟",
      "아홉",
      "열",
      "열하나",
      "열둘",
    ]);
  });
});
