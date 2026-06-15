import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import { z } from "zod";
import {
  premiumPipelineKeySegmentSchema,
  selectSinglePremiumKeySegment,
  type PremiumPipelineKeySegment,
  type PremiumPipelineRequest,
} from "@/lib/premium/pipeline";

type PremiumTranscriptLine = NonNullable<
  PremiumPipelineRequest["transcript"]
>[number];

export type PremiumKeySegmentResolution =
  | {
      keySegment: PremiumPipelineKeySegment;
      source: "ai";
      provider: "azure-openai" | "gemini";
      model: string;
    }
  | {
      keySegment: PremiumPipelineKeySegment;
      source: "fallback";
      provider: null;
      model: null;
    };

const aiKeySegmentResponseSchema = premiumPipelineKeySegmentSchema.extend({
  transcriptLineId: z.string().min(1).optional(),
  anchorExpression: z.string().min(1),
  practicalUseScore: z.number().min(1).max(5),
  frequencyScore: z.number().min(1).max(5),
  transferScore: z.number().min(1).max(5),
  koreanLearnerValueScore: z.number().min(1).max(5),
});

const geminiKeySegmentResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    title: { type: SchemaType.STRING },
    startTime: { type: SchemaType.NUMBER },
    endTime: { type: SchemaType.NUMBER },
    reason: { type: SchemaType.STRING },
    transcriptLineId: { type: SchemaType.STRING },
    anchorExpression: { type: SchemaType.STRING },
    practicalUseScore: { type: SchemaType.NUMBER },
    frequencyScore: { type: SchemaType.NUMBER },
    transferScore: { type: SchemaType.NUMBER },
    koreanLearnerValueScore: { type: SchemaType.NUMBER },
  },
  required: [
    "id",
    "title",
    "startTime",
    "endTime",
    "reason",
    "anchorExpression",
    "practicalUseScore",
    "frequencyScore",
    "transferScore",
    "koreanLearnerValueScore",
  ],
};

const azureKeySegmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    startTime: { type: "number" },
    endTime: { type: "number" },
    reason: { type: "string" },
    transcriptLineId: { type: "string" },
    anchorExpression: { type: "string" },
    practicalUseScore: { type: "number" },
    frequencyScore: { type: "number" },
    transferScore: { type: "number" },
    koreanLearnerValueScore: { type: "number" },
  },
  required: [
    "id",
    "title",
    "startTime",
    "endTime",
    "reason",
    "anchorExpression",
    "practicalUseScore",
    "frequencyScore",
    "transferScore",
    "koreanLearnerValueScore",
  ],
} as const;

function getAzureKeySegmentConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment =
    process.env.PREMIUM_KEY_SEGMENT_AZURE_DEPLOYMENT ||
    process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, deployment, apiVersion };
}

function getGeminiKeySegmentModel() {
  return process.env.PREMIUM_KEY_SEGMENT_MODEL || "gemini-2.5-pro";
}

function assertPromotedKeySegmentModel(model: string) {
  if (/flash/i.test(model)) {
    throw new Error(
      "Premium key segment selection must use a promoted model; Flash models are not allowed",
    );
  }
}

function formatTranscriptForPrompt(transcript: PremiumTranscriptLine[]) {
  return transcript
    .slice(0, 900)
    .map(
      (line) =>
        `${line.id} | ${line.startTime.toFixed(2)}-${line.endTime.toFixed(2)} | ${line.text}`,
    )
    .join("\n");
}

export function buildPremiumKeySegmentPrompt(input: {
  title?: string | null;
  sourceUrl: string;
  transcript: PremiumTranscriptLine[];
}) {
  return [
    "You are selecting the single key segment for an InputEnglish premium lesson.",
    "Return exactly one JSON object. Do not return an array, multiple clips, shorts, chapters, or split suggestions.",
    "Choose the one segment with the strongest real-life expression-learning value for a Korean adult learner who wants English they can actually use tomorrow.",
    "The segment should usually anchor to one transcript line and remain short; the app will add an editable +/- 90 second crop later.",
    "",
    "Hard selection gates:",
    "- The anchorExpression must be a reusable chunk, phrase, sentence frame, discourse move, or collocation from the source line, usually 2-8 words.",
    "- It must be useful outside this video in meetings, interviews, email, small talk, feedback, presentations, or everyday professional life.",
    "- It should support at least 3 natural variations across different situations.",
    "- Prefer high-frequency frames and chunks over clever, biographical, poetic, or one-off lines.",
    "- Prefer expressions that Korean speakers often underuse, mistranslate, over-literalize, or pronounce awkwardly.",
    "- Prefer expressions that can power article, pronunciation, saved review atoms, and roleplay without forcing the lesson.",
    "",
    "Reject or heavily penalize:",
    "- Self-labels or personality labels such as 'a bit of a procrastinator', 'I'm a nerd', 'I'm the kind of person who...'.",
    "- Rare nouns, cute descriptors, jokes, throwaway autobiographical details, proper-noun-dependent lines, slogans, quotes, and inspirational one-liners.",
    "- Expressions that are only interesting because of the speaker's personal story, not because learners can reuse them.",
    "- Generic lines with no useful chunk, even if the topic is emotionally strong.",
    "",
    "Scoring rubric, each 1-5:",
    "- practicalUseScore: Can the learner use it tomorrow in real conversations or writing?",
    "- frequencyScore: Is this a common, natural English chunk/frame rather than a rare novelty?",
    "- transferScore: Can it transfer to several situations with small changes?",
    "- koreanLearnerValueScore: Does it teach a nuance, register, collocation, or sound pattern Korean learners need?",
    "Only choose a segment if practicalUseScore >= 4, transferScore >= 4, and koreanLearnerValueScore >= 4. If multiple candidates pass, choose the highest frequencyScore.",
    "",
    `source_url: ${input.sourceUrl}`,
    `title: ${input.title ?? "(untitled)"}`,
    "",
    "transcript:",
    formatTranscriptForPrompt(input.transcript),
    "",
    "JSON shape:",
    '{"id":"segment-line-id","title":"short operator-facing title","startTime":0,"endTime":0,"reason":"why this reusable expression is the best practical anchor, including the key reject/accept tradeoff","transcriptLineId":"line-id","anchorExpression":"reusable chunk from the line","practicalUseScore":5,"frequencyScore":5,"transferScore":5,"koreanLearnerValueScore":5}',
  ].join("\n");
}

function parsePremiumKeySegmentOutput(
  raw: string,
  transcript: PremiumTranscriptLine[],
): PremiumPipelineKeySegment {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = aiKeySegmentResponseSchema.parse(JSON.parse(cleaned));

  if (parsed.endTime <= parsed.startTime) {
    throw new Error("AI key segment endTime must be greater than startTime");
  }

  const hasTranscriptCoverage = transcript.some(
    (line) =>
      line.endTime >= parsed.startTime && line.startTime <= parsed.endTime,
  );
  if (!hasTranscriptCoverage) {
    throw new Error("AI key segment has no transcript coverage");
  }

  return {
    id: parsed.id,
    title: parsed.title || parsed.anchorExpression,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    reason: [
      `표현: ${parsed.anchorExpression}`,
      `실전성 ${parsed.practicalUseScore}/5 · 빈도 ${parsed.frequencyScore}/5 · 확장성 ${parsed.transferScore}/5 · 한국인 학습가치 ${parsed.koreanLearnerValueScore}/5`,
      parsed.reason,
    ].join("\n"),
  };
}

async function generateKeySegmentWithAzureOpenAI(prompt: string) {
  const config = getAzureKeySegmentConfig();
  if (!config) return null;

  const response = await fetch(
    `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are the InputEnglish premium session segment selector. Return only one valid JSON object.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "premium_key_segment",
            strict: true,
            schema: azureKeySegmentJsonSchema,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Azure OpenAI key segment selection failed: ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Azure OpenAI key segment selection returned no content");
  }

  return {
    text: content,
    provider: "azure-openai" as const,
    model: config.deployment,
  };
}

async function generateKeySegmentWithGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelName = getGeminiKeySegmentModel();
  assertPromotedKeySegmentModel(modelName);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: geminiKeySegmentResponseSchema,
    },
  });

  const result = await model.generateContent(prompt);
  return {
    text: result.response.text(),
    provider: "gemini" as const,
    model: modelName,
  };
}

export async function resolvePremiumKeySegmentForPipeline(input: {
  sourceUrl: string;
  title?: string | null;
  transcript: PremiumTranscriptLine[];
}): Promise<PremiumKeySegmentResolution> {
  if (!input.transcript.length) {
    throw new Error("transcript is required before selecting a key segment");
  }

  const prompt = buildPremiumKeySegmentPrompt(input);
  const generation =
    (await generateKeySegmentWithAzureOpenAI(prompt)) ??
    (await generateKeySegmentWithGemini(prompt));

  if (!generation) {
    return {
      keySegment: selectSinglePremiumKeySegment(input.transcript),
      source: "fallback",
      provider: null,
      model: null,
    };
  }

  return {
    keySegment: parsePremiumKeySegmentOutput(generation.text, input.transcript),
    source: "ai",
    provider: generation.provider,
    model: generation.model,
  };
}
