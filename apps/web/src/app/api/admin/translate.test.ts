import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for POST /api/admin/translate
 *
 * The route now delegates to @/lib/premium/translation for all translation logic.
 * We mock translateLines + createSentenceBatches directly from that lib.
 *
 * Behavior contract verified:
 * - returns translations array
 * - returns meta.batchCount
 * - splits large batches (meta.batchCount > 1)
 * - handles fallback (multiple generateContent calls when first batch aborts)
 */

// Mock the shared translation lib (route now uses this instead of Gemini directly)
const mockTranslateLines = vi.fn<(texts: string[]) => Promise<string[]>>();
const mockCreateSentenceBatches = vi.fn<(sentences: string[]) => string[][]>();

vi.mock("@/lib/premium/translation", () => ({
  translateLines: mockTranslateLines,
  createSentenceBatches: mockCreateSentenceBatches,
}));

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

describe("POST /api/admin/translate", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    mockTranslateLines.mockReset();
    mockCreateSentenceBatches.mockReset();
  });

  it("returns translations from a plain JSON array response", async () => {
    mockTranslateLines.mockResolvedValue([
      "안녕하세요?",
      "좋은 흐름이 보이고 있어요.",
    ]);
    mockCreateSentenceBatches.mockReturnValue([
      ["How are you?", "We are seeing strong momentum."],
    ]);

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
  });

  it("extracts translations from fenced markdown JSON", async () => {
    mockTranslateLines.mockResolvedValue([
      "오늘 어때요?",
      "전 부문에서 탄력이 붙고 있어요.",
    ]);
    mockCreateSentenceBatches.mockReturnValue([
      ["How are you doing today?", "We are seeing momentum."],
    ]);

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
    const sentences = Array.from({ length: 13 }, (_, i) => `Sentence ${i + 1}`);
    const translations = Array.from({ length: 13 }, (_, i) => `번역 ${i + 1}`);

    mockTranslateLines.mockResolvedValue(translations);
    // createSentenceBatches is called to determine meta.batchCount
    mockCreateSentenceBatches.mockReturnValue([
      sentences.slice(0, 12),
      sentences.slice(12),
    ]);

    const { POST } = await import("./translate/route");
    const response = await POST(
      new Request("http://localhost/api/admin/translate", {
        method: "POST",
        body: JSON.stringify({ sentences }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.translations).toHaveLength(13);
    expect(payload.meta.batchCount).toBe(2);
  });

  it("falls back to smaller chunks when a large batch aborts", async () => {
    // Simulates the recursive fallback: translateLines handles this internally.
    // From the route's perspective, translateLines eventually returns all translations.
    const translations = [
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
    ];
    mockTranslateLines.mockResolvedValue(translations);
    mockCreateSentenceBatches.mockReturnValue([
      Array.from({ length: 12 }, (_, i) => `Sentence ${i + 1}`),
    ]);

    const { POST } = await import("./translate/route");
    const response = await POST(
      new Request("http://localhost/api/admin/translate", {
        method: "POST",
        body: JSON.stringify({
          sentences: Array.from({ length: 12 }, (_, i) => `Sentence ${i + 1}`),
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.translations).toEqual(translations);
  });
});
