import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 55_000;
const MAX_BATCH_SENTENCES = 12;
const MAX_BATCH_CHARACTERS = 1_800;

function extractTranslations(
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
        return parsed.map((item) => item.trim());
      }

      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { translations?: unknown }).translations)
      ) {
        const translations = (parsed as { translations: unknown[] })
          .translations;
        if (translations.every((item) => typeof item === "string")) {
          return translations.map((item) => item.trim());
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

function buildTranslationPrompt(sentences: string[]): string {
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

function createSentenceBatches(sentences: string[]): string[][] {
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
    console.error("Failed to parse AI response:", responseText);
    throw new Error("AI response was not a valid JSON array");
  }
}

async function translateBatchWithFallback(
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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { sentences } = await request.json();

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "Sentences array is required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    const batches = createSentenceBatches(sentences);
    const translatedBatches: string[][] = [];

    for (const batch of batches) {
      translatedBatches.push(await translateBatchWithFallback(model, batch));
    }

    return NextResponse.json({
      translations: translatedBatches.flat(),
      meta: {
        batchCount: batches.length,
      },
    });
  } catch (error: unknown) {
    console.error("Translation API error:", error);
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "번역 요청이 오래 걸려서 중단됐어요. 범위를 조금만 줄이거나 다시 시도해 주세요."
        : error instanceof Error
          ? error.message
          : "Failed to translate";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
