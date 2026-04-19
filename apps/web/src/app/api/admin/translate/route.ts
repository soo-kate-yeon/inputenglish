import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 55_000;

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

    const prompt = `
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let result: Awaited<ReturnType<typeof model.generateContent>>;
    try {
      result = await model.generateContent(prompt, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = result.response.text();

    try {
      const translations = extractTranslations(responseText, sentences.length);

      return NextResponse.json({
        translations,
      });
    } catch {
      console.error("Failed to parse AI response:", responseText);
      throw new Error("AI response was not a valid JSON array");
    }
  } catch (error: unknown) {
    console.error("Translation API error:", error);
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Translation request timed out"
        : error instanceof Error
          ? error.message
          : "Failed to translate";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
