/**
 * Tests for apps/web/src/lib/premium/translation.ts
 *
 * TDD cycle: RED → GREEN → REFACTOR
 *
 * AC-001-2: translation fill
 * AC-001-2 fixture-mode isolation (EC-001-D)
 *
 * NOTE: vitest config has clearMocks:true + restoreMocks:true which resets
 * mock implementations between tests. We use vi.mocked() + beforeEach to
 * restore implementations that need to be active in the GREEN path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── module-level mock for @google/generative-ai ───────────────────────────────
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(),
}));

// ── module under test (imported after vi.mock hoisting) ───────────────────────
import {
  translateLines,
  buildTranslationPrompt,
  createSentenceBatches,
  extractTranslations,
} from "../translation";

// ── helpers ───────────────────────────────────────────────────────────────────
function makeGeminiResponse(translations: string[]) {
  return {
    response: { text: () => JSON.stringify(translations) },
  };
}

function setupGeminiMock(generateContent: ReturnType<typeof vi.fn>) {
  vi.mocked(GoogleGenerativeAI).mockImplementation(
    () =>
      ({
        getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
      }) as unknown as GoogleGenerativeAI,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// translateLines — high-level entry point
// ═══════════════════════════════════════════════════════════════════════════
describe("translateLines", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.TRANSLATION_FIXTURE_MODE;
  });

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.GEMINI_API_KEY = savedKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    delete process.env.TRANSLATION_FIXTURE_MODE;
  });

  it("returns stub translations in fixture mode (GEMINI_API_KEY unset)", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await translateLines(["Hello world", "Good morning"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatch(/^\[ko\]/);
    expect(result[1]).toMatch(/^\[ko\]/);
    expect(vi.mocked(GoogleGenerativeAI)).not.toHaveBeenCalled();
  });

  it("returns stub translations when TRANSLATION_FIXTURE_MODE=true", async () => {
    process.env.TRANSLATION_FIXTURE_MODE = "true";

    const result = await translateLines(["Test sentence"]);
    expect(result[0]).toMatch(/^\[ko\]/);
    expect(vi.mocked(GoogleGenerativeAI)).not.toHaveBeenCalled();
  });

  it("calls Gemini and returns translations when API key is present", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValue(makeGeminiResponse(["안녕 세상", "좋은 아침"]));
    setupGeminiMock(generateContent);

    const result = await translateLines(["Hello world", "Good morning"]);
    expect(result).toEqual(["안녕 세상", "좋은 아침"]);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("returns the same number of translations as input texts", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValue(makeGeminiResponse(["가", "나", "다"]));
    setupGeminiMock(generateContent);

    const result = await translateLines(["A", "B", "C"]);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input without calling Gemini", async () => {
    const result = await translateLines([]);
    expect(result).toEqual([]);
    expect(vi.mocked(GoogleGenerativeAI)).not.toHaveBeenCalled();
  });

  it("splits into batches of at most 12 sentences", async () => {
    const texts = Array.from({ length: 13 }, (_, i) => `Sentence ${i + 1}`);
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce(
        makeGeminiResponse(
          Array.from({ length: 12 }, (_, i) => `번역 ${i + 1}`),
        ),
      )
      .mockResolvedValueOnce(makeGeminiResponse(["번역 13"]));
    setupGeminiMock(generateContent);

    const result = await translateLines(texts);
    expect(result).toHaveLength(13);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildTranslationPrompt
// ═══════════════════════════════════════════════════════════════════════════
describe("buildTranslationPrompt", () => {
  it("includes the input sentences serialized as JSON", () => {
    const sentences = ["Hello", "World"];
    const prompt = buildTranslationPrompt(sentences);
    expect(prompt).toContain(JSON.stringify(sentences));
  });

  it("instructs the model to return a JSON array", () => {
    const prompt = buildTranslationPrompt(["test"]);
    expect(prompt.toLowerCase()).toContain("json");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createSentenceBatches
// ═══════════════════════════════════════════════════════════════════════════
describe("createSentenceBatches", () => {
  it("puts ≤12 sentences in a single batch", () => {
    const sentences = Array.from({ length: 10 }, (_, i) => `S${i}`);
    const batches = createSentenceBatches(sentences);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(10);
  });

  it("splits 13 sentences into two batches", () => {
    const sentences = Array.from({ length: 13 }, (_, i) => `S${i}`);
    const batches = createSentenceBatches(sentences);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(12);
    expect(batches[1]).toHaveLength(1);
  });

  it("splits by character limit even when under sentence limit", () => {
    const long = "x".repeat(400);
    const sentences = Array.from({ length: 5 }, () => long);
    const batches = createSentenceBatches(sentences);
    expect(batches.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractTranslations
// ═══════════════════════════════════════════════════════════════════════════
describe("extractTranslations", () => {
  it("parses a plain JSON array", () => {
    const result = extractTranslations(JSON.stringify(["가", "나"]), 2);
    expect(result).toEqual(["가", "나"]);
  });

  it("parses a fenced markdown JSON array", () => {
    const result = extractTranslations('```json\n["가", "나"]\n```', 2);
    expect(result).toEqual(["가", "나"]);
  });

  it("throws when translation count does not match expected", () => {
    expect(() => extractTranslations(JSON.stringify(["가"]), 2)).toThrow();
  });

  it("throws when response is not valid JSON", () => {
    expect(() => extractTranslations("not json at all", 1)).toThrow();
  });
});
