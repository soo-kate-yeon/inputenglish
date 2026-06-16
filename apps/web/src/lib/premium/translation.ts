/**
 * @MX:NOTE: [AUTO] Shared translation library extracted from translate/route.ts.
 * Provides translateLines() as the high-level entry point for ingest and other consumers.
 * When GEMINI_API_KEY is unset OR TRANSLATION_FIXTURE_MODE=true, returns deterministic
 * stub translations prefixed with "[ko]" so tests run without network access.
 * @MX:SPEC: SPEC-INPUT-002 - Phase 1, Task 1.1
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── constants ────────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 55_000;
const MAX_BATCH_SENTENCES = 12;
const MAX_BATCH_CHARACTERS = 1_800;

// ── Gemini factory ────────────────────────────────────────────────────────────
function createGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
}

// ── fixture/short-circuit mode ────────────────────────────────────────────────
function isFixtureMode(): boolean {
  return (
    !process.env.GEMINI_API_KEY ||
    process.env.TRANSLATION_FIXTURE_MODE === "true"
  );
}

function stubTranslations(texts: string[]): string[] {
  return texts.map((t) => `[ko] ${t}`);
}

// ── exported granular functions ───────────────────────────────────────────────

/**
 * Build a translation prompt for the given sentences.
 * Instructs Gemini to return a JSON array of Korean translations.
 */
export function buildTranslationPrompt(sentences: string[]): string {
  return `
You are a professional English-Korean translator specializing in natural spoken Korean.

CRITICAL RULES:
- Translate into natural, casual Korean conversational style (자연스러운 한국어 구어체).
- Use spoken Korean patterns, NOT written/formal Korean (e.g., "~거든요", "~잖아요", "~인 거예요" over "~입니다", "~것입니다").
- Keep the tone matching the original: if casual, stay casual; if professional, use polite but natural spoken Korean (존댓말 구어체).
- Avoid overly literal translations. Convey the meaning the way a Korean person would naturally say it in conversation.
- Do NOT transliterate proper nouns unnecessarily. Keep well-known English terms as-is when commonly used in Korean (e.g., "AI", "API", "CEO").

Return ONLY a JSON array of strings, where each string is the translation corresponding to the input sentence index.
Do not include any other text or markdown formatting (like \`\`\`json). Just the raw array.

Input Sentences:
${JSON.stringify(sentences)}
`;
}

/**
 * Split sentences into batches respecting sentence-count and character-count limits.
 */
export function createSentenceBatches(sentences: string[]): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentCharacters = 0;

  for (const sentence of sentences) {
    const sentenceCharacters = sentence.length;
    const wouldExceedCount = currentBatch.length >= MAX_BATCH_SENTENCES;
    const wouldExceedCharacters =
      currentBatch.length > 0 &&
      currentCharacters + sentenceCharacters > MAX_BATCH_CHARACTERS;

    if (wouldExceedCount || wouldExceedCharacters) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacters = 0;
    }

    currentBatch.push(sentence);
    currentCharacters += sentenceCharacters;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Extract and validate translations from a Gemini response string.
 * Handles plain JSON arrays and fenced markdown JSON blocks.
 */
export function extractTranslations(
  responseText: string,
  expectedLength: number,
): string[] {
  const cleanedText = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const tryParseArray = (value: string): string[] | null => {
    try {
      const parsed = JSON.parse(value) as unknown;

      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "string")
      ) {
        return parsed.map((item) => (item as string).trim());
      }

      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { translations?: unknown }).translations)
      ) {
        const translations = (parsed as { translations: unknown[] })
          .translations;
        if (translations.every((item) => typeof item === "string")) {
          return translations.map((item) => (item as string).trim());
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  const direct = tryParseArray(cleanedText);
  if (direct) {
    if (direct.length !== expectedLength) {
      throw new Error("AI returned unmatched number of translations");
    }
    return direct;
  }

  const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const extracted = tryParseArray(arrayMatch[0]);
    if (extracted) {
      if (extracted.length !== expectedLength) {
        throw new Error("AI returned unmatched number of translations");
      }
      return extracted;
    }
  }

  throw new Error("AI response was not a valid JSON array");
}

// ── internal batch request helpers ────────────────────────────────────────────

async function requestBatchTranslations(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  sentences: string[],
): Promise<string[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let result: Awaited<ReturnType<typeof model.generateContent>>;
  try {
    result = await model.generateContent(buildTranslationPrompt(sentences), {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = result.response.text();

  try {
    return extractTranslations(responseText, sentences.length);
  } catch {
    console.error("[translation] Failed to parse AI response:", responseText);
    throw new Error("AI response was not a valid JSON array");
  }
}

export async function translateBatchWithFallback(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  sentences: string[],
): Promise<string[]> {
  try {
    return await requestBatchTranslations(model, sentences);
  } catch (error) {
    if (sentences.length <= 1) {
      throw error;
    }

    const midpoint = Math.ceil(sentences.length / 2);
    const left = sentences.slice(0, midpoint);
    const right = sentences.slice(midpoint);

    const [leftTranslations, rightTranslations] = await Promise.all([
      translateBatchWithFallback(model, left),
      translateBatchWithFallback(model, right),
    ]);

    return [...leftTranslations, ...rightTranslations];
  }
}

// ── high-level entry point ────────────────────────────────────────────────────

/**
 * @MX:ANCHOR: [AUTO] High-level translation entry point used by ingest chain.
 * @MX:REASON: fan_in >= 2 (ingest/route.ts + tests); single public contract for
 * all translation consumers. Fixture-mode short-circuit prevents LLM calls in tests.
 *
 * Translates an array of English texts to Korean.
 * - In fixture mode (no GEMINI_API_KEY or TRANSLATION_FIXTURE_MODE=true):
 *   returns deterministic stubs: "[ko] <original>".
 * - Otherwise: uses Gemini gemini-2.5-flash with batch splitting and recursive fallback.
 */
export async function translateLines(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];

  if (isFixtureMode()) {
    return stubTranslations(texts);
  }

  const model = createGeminiModel();
  const batches = createSentenceBatches(texts);
  const translatedBatches: string[][] = [];

  for (const batch of batches) {
    translatedBatches.push(await translateBatchWithFallback(model, batch));
  }

  return translatedBatches.flat();
}
