import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Sentence, SceneAnalysisResponse } from "@shadowoo/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
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

    // Need at least 5 sentences to make meaningful scene recommendations
    if (sentences.length < 5) {
      return NextResponse.json(
        { error: "Need at least 5 sentences for scene analysis" },
        { status: 400 },
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Format sentences with indices for easy reference
    const sentencesText = sentences
      .map(
        (s: Sentence, idx: number) =>
          `[${idx}] ${s.text} (${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s)`,
      )
      .join("\n");

    const prompt = `
You are a professional English speaking tutor analyzing a video transcript for language learning.

Your task is to identify exactly 3 scenes from this transcript that are most valuable for English learners to practice speaking.

Consider the following criteria:
1. **Useful Expressions**: Rich vocabulary, idiomatic expressions, common phrases
2. **Practical Context**: Real-world conversational scenarios that learners can use
3. **Pronunciation Practice**: Clear speech patterns, useful intonation examples
4. **Learning Value**: Grammar structures, colloquialisms, natural speech flow
5. **Duration**: Each scene should be 30-120 seconds long (check timestamps)

**IMPORTANT**: Provide all text content (title, reason, learningPoints) in Korean language for Korean learners.

Transcript:
${sentencesText}

Return ONLY a valid JSON object (no markdown formatting) with this exact structure:
{
  "scenes": [
    {
      "startIndex": 0,
      "endIndex": 3,
      "title": "간단한 씬 제목 (한국어)",
      "reason": "이 씬이 학습에 유용한 이유 (한국어로 작성)",
      "learningPoints": ["학습 포인트 1", "학습 포인트 2", "학습 포인트 3"],
      "estimatedDuration": 45
    }
  ],
  "totalAnalyzed": ${sentences.length}
}

Requirements:
- Return exactly 3 scenes
- Scenes should not overlap
- startIndex and endIndex are array indices (0-based)
- estimatedDuration should be calculated from timestamps (endTime - startTime)
- learningPoints should be specific (e.g., "phrasal verb 'figure out'", "past perfect tense usage")
- All scenes combined should cover interesting parts but not necessarily the entire video
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let analysisResult: SceneAnalysisResponse;
    try {
      // Clean up potentially wrapped markdown
      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      analysisResult = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse AI response:", responseText);
      throw new Error("AI response was not valid JSON");
    }

    // Validate response structure
    if (!analysisResult.scenes || !Array.isArray(analysisResult.scenes)) {
      throw new Error("Invalid response structure from AI");
    }

    if (analysisResult.scenes.length !== 3) {
      throw new Error("AI did not return exactly 3 scenes");
    }

    // Validate each scene
    for (const scene of analysisResult.scenes) {
      if (
        typeof scene.startIndex !== "number" ||
        typeof scene.endIndex !== "number" ||
        !scene.title ||
        !scene.reason ||
        !Array.isArray(scene.learningPoints)
      ) {
        throw new Error("Invalid scene structure");
      }

      // Validate indices are within bounds
      if (
        scene.startIndex < 0 ||
        scene.endIndex >= sentences.length ||
        scene.startIndex > scene.endIndex
      ) {
        throw new Error(
          `Invalid scene indices: ${scene.startIndex}-${scene.endIndex}`,
        );
      }
    }

    return NextResponse.json(analysisResult);
  } catch (error: any) {
    console.error("Scene analysis API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze scenes" },
      { status: 500 },
    );
  }
}
