import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Sentence, SceneAnalysisResponse } from "@shadowoo/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Format sentences with indices for easy reference
    const sentencesText = sentences
      .map(
        (s: Sentence, idx: number) =>
          `[${idx}] ${s.text} (${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s)`,
      )
      .join("\n");

    const prompt = `
You are curating transcript scenes for a professional English shadowing product for Korean users.

Your job is NOT to find generic "good English" moments.
Your job is to identify exactly 3 scenes that can become high-value speaking sessions for business users.

Prioritize scenes with strong product value using this order:
1. **Speaking Purpose Clarity**: The scene trains a clear speaking job such as explaining a metric, giving an update, proposing a direction, answering a question, persuading, summarizing, disagreeing carefully, or hedging.
2. **Business Scenario Reuse**: The language can realistically be reused in work situations such as a demo, stakeholder update, status briefing, earnings discussion, roadmap review, interview, or Q&A.
3. **Sessionization Potential**: The clip contains a coherent mini-flow with beginning, development, and conclusion, so it can stand alone as one learning session.
4. **Professional Tone Quality**: The speaker demonstrates concise, calm, credible business communication rather than casual chat or filler-heavy conversation.
5. **Learning Leverage**: The scene includes reusable phrasing, sentence patterns, framing logic, or rhetorical moves that a user can copy into their own speaking.
6. **Duration**: Each scene should be 30-120 seconds long based on timestamps.

Avoid selecting scenes that are weak for productization:
- generic small talk
- hype without reusable structure
- vague banter with little speaking purpose
- clips that only have interesting vocabulary but no clear work-use scenario
- fragmented moments that do not stand alone as a session

For each scene:
- Title should sound like a session title a learner would want to open.
- Reason should explain why this scene is worth productizing, focusing on speaking purpose + business scenario + expected learner payoff.
- Learning points should be phrased as practical session outcomes, not abstract grammar labels only.

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
- learningPoints should be specific and practical (e.g., "숫자 변화를 설명할 때 쓰는 완급 조절", "질문에 바로 답하지 않고 맥락을 먼저 주는 답변 구조")
- At least 2 of the 3 scenes should clearly map to a concrete business speaking scenario
- All scenes combined should maximize product value, not just transcript coverage
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
