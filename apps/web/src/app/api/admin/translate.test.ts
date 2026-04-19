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
});
