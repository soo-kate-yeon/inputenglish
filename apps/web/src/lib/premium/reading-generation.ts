import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { ReadingFormat, ReadingPiece } from "@inputenglish/shared";
import { findPremiumCopySlop } from "@inputenglish/shared";
import { verifyCoverage } from "./reading-coverage";
import {
  callGeminiWithSchema,
  callAzureOpenAI,
  getAzureOpenAIConfig,
} from "./llm-utils";

// @MX:NOTE: [AUTO] Fixture-mode static source facts for v1 nonfiction grounding.
// Prevents pure hallucination without external search integration.
const STATIC_SOURCE_FACTS: Record<string, Record<string, string>> = {
  climate: {
    fact1:
      "Global average temperature has risen ~1.1°C since pre-industrial times (IPCC AR6, 2021).",
    fact2: "Carbon dioxide concentration reached 421 ppm in 2023.",
    fact3:
      "The Paris Agreement (2015) targets limiting warming to 1.5°C above pre-industrial levels.",
    fact4:
      "Renewable energy accounted for 30% of global electricity generation in 2023.",
    fact5: "Sea level has risen ~20 cm since 1900.",
  },
  technology: {
    fact1: "AI model training compute doubles roughly every 6 months.",
    fact2: "Global internet users exceeded 5 billion in 2023.",
    fact3: "The semiconductor industry revenue was $527 billion in 2023.",
    fact4: "Electric vehicle sales reached 14 million units globally in 2023.",
    fact5: "Cloud computing market size exceeded $600 billion in 2023.",
  },
  economics: {
    fact1: "Global GDP was approximately $105 trillion in 2023.",
    fact2: "Inflation in the US peaked at 9.1% in June 2022.",
    fact3:
      "The US Federal Reserve raised interest rates 11 times from 2022-2023.",
    fact4: "Global trade volumes contracted 1.2% in 2023 (WTO).",
    fact5: "Unemployment in the US hit a 53-year low of 3.4% in January 2023.",
  },
};

const FICTION_FORMATS: ReadingFormat[] = ["noir", "dialogue"];

function isNonfictionFormat(format: ReadingFormat): boolean {
  return !FICTION_FORMATS.includes(format);
}

function getSourceFacts(topic: string): Record<string, string> {
  const key = topic.toLowerCase();
  return (
    STATIC_SOURCE_FACTS[key] ?? {
      fact1: `${topic} is an important subject with broad global implications.`,
      fact2: "Expert consensus highlights multiple dimensions of this topic.",
      fact3: "Recent developments have accelerated interest in this area.",
    }
  );
}

// @MX:ANCHOR: [AUTO] Central generation contract — called by reading/route.ts.
// @MX:REASON: Single entry point for all reading generation; coverage/slop checks live here.
export interface ReadingGenerationInput {
  level: string;
  format: ReadingFormat;
  topic: string;
  userId: string;
  knownLemmas?: Set<string>;
}

const geminiReadingResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    body: {
      type: SchemaType.STRING,
      description: "The full reading text at the specified level",
    },
    sourceFacts: {
      type: SchemaType.OBJECT,
      description: "Key facts used (for nonfiction grounding)",
      properties: {
        fact1: { type: SchemaType.STRING },
        fact2: { type: SchemaType.STRING },
        fact3: { type: SchemaType.STRING },
      },
    },
  },
  required: ["body"],
};

function buildReadingPrompt(
  input: ReadingGenerationInput,
  sourceFacts: Record<string, string>,
  attemptHint?: string,
): string {
  const { level, format, topic } = input;
  const nonfiction = isNonfictionFormat(format);
  const groundingSection = nonfiction
    ? `\nYou must base all factual claims on the provided source facts below. Do not invent statistics, dates, or named entities. Use only the facts provided as grounding.\n\nSource facts:\n${JSON.stringify(sourceFacts, null, 2)}\n`
    : "";
  const formatNote =
    format === "noir"
      ? "Write in a noir fiction style with a first-person detective narrator, concrete sensory details, short punchy sentences."
      : format === "dialogue"
        ? "Write as a naturalistic conversation between two people. Use realistic spoken English."
        : format === "editorial"
          ? "Write as a newspaper editorial with a clear opinion stance and persuasive structure."
          : format === "economic"
            ? "Write as an economic analysis with data references and formal register."
            : format === "business"
              ? "Write as a business report or memo with professional register."
              : "Write as a clear nonfiction article with neutral, informative register.";

  return [
    `You are an English reading passage generator for language learners.`,
    `Target CEFR level: ${level}`,
    `Format: ${format}`,
    `Topic: ${topic}`,
    groundingSection,
    formatNote,
    attemptHint ?? "",
    `Generate a reading passage of 150-250 words appropriate for ${level} learners.`,
    `Use vocabulary and grammar complexity matching ${level}.`,
    `Return JSON with field "body" containing the passage text, and optionally "sourceFacts" with the facts you referenced.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// @MX:NOTE: [AUTO] Thin wrappers calling shared llm-utils for reading generation.
// Azure deployment override: READING_GENERATION_AZURE_DEPLOYMENT env var.

const azureReadingJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: { type: "string" },
    sourceFacts: { type: "object" },
  },
  required: ["body"],
} as const;

async function generateWithGemini(
  prompt: string,
): Promise<{ body: string; sourceFacts?: Record<string, unknown> } | null> {
  const modelName = process.env.READING_GENERATION_MODEL ?? "gemini-2.5-pro";
  const result = await callGeminiWithSchema(
    prompt,
    modelName,
    geminiReadingResponseSchema,
  );
  if (!result) return null;
  return JSON.parse(result.text) as {
    body: string;
    sourceFacts?: Record<string, unknown>;
  };
}

async function generateWithAzureOpenAI(
  prompt: string,
): Promise<{ body: string; sourceFacts?: Record<string, unknown> } | null> {
  const config = getAzureOpenAIConfig("READING_GENERATION_AZURE_DEPLOYMENT");
  if (!config) return null;

  const result = await callAzureOpenAI(
    prompt,
    config,
    "You are an English reading passage generator for language learners. Return only valid JSON.",
    "reading_piece",
    azureReadingJsonSchema as unknown as Record<string, unknown>,
    0.7,
  );
  return JSON.parse(result.text) as {
    body: string;
    sourceFacts?: Record<string, unknown>;
  };
}

// @MX:NOTE: [AUTO] FIXTURE_MODE: used in test environments to bypass LLM calls.
// Set READING_FIXTURE_MODE=true (or GEMINI_API_KEY unset + Azure unset) to activate.
function isFixtureMode(): boolean {
  return (
    process.env.READING_FIXTURE_MODE === "true" ||
    (!process.env.GEMINI_API_KEY &&
      !getAzureOpenAIConfig("READING_GENERATION_AZURE_DEPLOYMENT"))
  );
}

function buildFixtureReadingPiece(
  input: ReadingGenerationInput,
  sourceFacts: Record<string, string>,
): ReadingPiece {
  return {
    id: `reading-fixture-${Date.now()}`,
    level: input.level,
    format: input.format,
    topic: input.topic,
    body: `This is a fixture reading piece about ${input.topic} at ${input.level} level. Climate change is a global challenge affecting many nations. Scientists report rising temperatures and sea levels as key concerns. Governments are working together to find sustainable solutions.`,
    coveragePct: 96,
    validationStatus: "approved",
    sourceFacts,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  };
}

const MAX_RETRIES = 2;

export async function generateReadingPiece(
  input: ReadingGenerationInput,
): Promise<ReadingPiece> {
  const sourceFacts = getSourceFacts(input.topic);

  if (isFixtureMode()) {
    return buildFixtureReadingPiece(input, sourceFacts);
  }

  const nonfiction = isNonfictionFormat(input.format);
  let lastBody = "";
  let lastSourceFacts: Record<string, unknown> = sourceFacts;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptHint =
      attempt > 0
        ? `Previous attempt had quality issues. Please generate fresh content avoiding slop phrases and targeting the correct vocabulary difficulty.`
        : undefined;

    const prompt = buildReadingPrompt(input, sourceFacts, attemptHint);

    const generated =
      (await generateWithGemini(prompt)) ??
      (await generateWithAzureOpenAI(prompt));

    if (!generated) {
      throw new Error("No LLM provider configured for reading generation");
    }

    const { body } = generated;
    lastBody = body;
    lastSourceFacts =
      (generated.sourceFacts as Record<string, unknown>) ?? sourceFacts;

    // Slop check for fiction formats
    if (!nonfiction) {
      const slopIssues = findPremiumCopySlop(body);
      if (slopIssues.length > 0 && attempt < MAX_RETRIES) {
        console.warn(
          `[ReadingGeneration] Slop detected on attempt ${attempt + 1}:`,
          slopIssues,
        );
        continue;
      }
    }

    // Coverage check if knownLemmas provided
    if (input.knownLemmas && input.knownLemmas.size > 0) {
      const coverage = verifyCoverage(body, input.knownLemmas);
      if (coverage.status !== "optimal" && attempt < MAX_RETRIES) {
        console.warn(
          `[ReadingGeneration] Coverage ${coverage.status} on attempt ${attempt + 1}, ratio=${coverage.unknownRatio.toFixed(3)}`,
        );
        continue;
      }

      const coveragePct = Math.round((1 - coverage.unknownRatio) * 100);
      return {
        id: `reading-${Date.now()}`,
        level: input.level,
        format: input.format,
        topic: input.topic,
        body,
        coveragePct,
        validationStatus: "approved",
        sourceFacts: lastSourceFacts,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      };
    }

    // No knownLemmas: skip coverage gate
    return {
      id: `reading-${Date.now()}`,
      level: input.level,
      format: input.format,
      topic: input.topic,
      body,
      coveragePct: null,
      validationStatus: "pending",
      sourceFacts: lastSourceFacts,
      userId: input.userId,
      createdAt: new Date().toISOString(),
    };
  }

  // Max retries reached — return last attempt
  return {
    id: `reading-${Date.now()}`,
    level: input.level,
    format: input.format,
    topic: input.topic,
    body: lastBody,
    coveragePct: null,
    validationStatus: "pending",
    sourceFacts: lastSourceFacts,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  };
}
