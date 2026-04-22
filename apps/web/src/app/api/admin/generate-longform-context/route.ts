import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LongformContext, Sentence } from "@inputenglish/shared";
import { rewriteCopyToKoreanIfNeeded } from "../utils/korean-copy";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface GenerateLongformContextRequest {
  title: string;
  description?: string;
  sentences: Sentence[];
  primarySpeakerName?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as GenerateLongformContextRequest;
    const { title, description, sentences, primarySpeakerName } = body;

    if (!title || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: "title and sentences are required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const transcript = sentences.map((sentence) => sentence.text).join(" ");
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `
팟캐스트 영어 학습용 longform pack의 사전 컨텍스트를 한국어로 작성해.

중요:
- short session context처럼 pattern이나 transformation 중심으로 쓰지 마라
- 이 컨텍스트는 "이 긴 구간을 어떤 관점으로 들어야 하는지"를 알려주는 안내문이다
- 화자, 대화 형식, 핵심 주제, 왜 이 구간이 중요한지가 핵심이다
- 모든 출력은 자연스러운 한국어 UX writing이어야 한다
- 영어 설명문을 그대로 남기지 말고, 한국어로 짧고 매끄럽게 풀어 쓸 것
- 교과서식 문어체보다 앱 안내문처럼 읽히는 한국어를 우선할 것
- 문장 끝은 가능하면 '~어요/~예요'로 맞춰라

입력:
- 제목: ${title}
- 설명: ${description ?? ""}
- 대표 화자: ${primarySpeakerName ?? "없음"}

Transcript:
${transcript}

Return ONLY valid JSON:
{
  "speaker_snapshot": "string",
  "conversation_type": "string",
  "core_topics": ["string"],
  "why_this_segment": "string",
  "listening_takeaway": "string"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleaned = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as LongformContext;

    if (!parsed.speaker_snapshot || !parsed.conversation_type) {
      throw new Error("Invalid longform context response");
    }

    const responsePayload = {
      context: {
        speaker_snapshot: parsed.speaker_snapshot.trim(),
        conversation_type: parsed.conversation_type.trim(),
        core_topics: Array.isArray(parsed.core_topics)
          ? parsed.core_topics.map((item) => item.trim()).filter(Boolean)
          : [],
        why_this_segment: parsed.why_this_segment.trim(),
        listening_takeaway: parsed.listening_takeaway.trim(),
        generated_by: "gemini",
      } satisfies LongformContext,
    };

    const localizedPayload = await rewriteCopyToKoreanIfNeeded({
      model,
      payload: responsePayload,
      fieldPaths: [
        "context.speaker_snapshot",
        "context.conversation_type",
        "context.core_topics",
        "context.why_this_segment",
        "context.listening_takeaway",
      ],
      instructions:
        "모든 필드를 앱에서 바로 읽히는 짧고 자연스러운 한국어로 다듬어라. 설명 문장 끝은 가능하면 `~어요/~예요` 톤으로 맞춰라.",
    });

    return NextResponse.json(localizedPayload);
  } catch (error) {
    console.error("Longform context generation API error:", error);
    return NextResponse.json(
      { error: "Failed to generate longform context" },
      { status: 500 },
    );
  }
}
