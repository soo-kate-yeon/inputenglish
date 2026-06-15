import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import {
  buildExpressionCardPrompt,
  PREMIUM_EXPRESSION_PROMPT_VERSION,
  type PremiumExpressionCard,
  type PremiumExpressionDepth,
  type PremiumTranscriptLine,
} from "@inputenglish/shared";
import {
  parseAiExpressionCard,
  premiumExpressionCardSchema,
  type PremiumSessionDraftInput,
} from "@/lib/premium/session-schema";
import {
  callGeminiWithSchema,
  callAzureOpenAI,
  getAzureOpenAIConfig,
} from "@/lib/premium/llm-utils";

export const premiumExpressionCardRequestSchema = z.object({
  expression: z.string().min(1),
  sourceLine: z.string().min(1),
  timestamp: z.string().min(1),
  speaker: z.string().min(1),
  videoContext: z.string().min(1),
  transcriptExcerpt: z.string().min(1),
  userProfile: z.string().min(1),
  depth: z.enum(["anchor", "support"]).default("anchor"),
});

export type PremiumExpressionCardRequest = z.infer<
  typeof premiumExpressionCardRequestSchema
>;

export interface PremiumExpressionGenerationMeta {
  promptVersion: typeof PREMIUM_EXPRESSION_PROMPT_VERSION;
  provider: "azure-openai" | "gemini";
  model: string;
}

export interface PremiumExpressionGenerationResult {
  card: Omit<PremiumExpressionCard, "id" | "order_index">;
  meta: PremiumExpressionGenerationMeta;
}

export type PremiumExpressionCardGenerationResolution =
  | {
      source: "ai";
      provider: "azure-openai" | "gemini";
      model: string;
      cards: PremiumExpressionCard[];
    }
  | {
      source: "fallback";
      provider: null;
      model: null;
      cards: PremiumExpressionCard[];
    };

const geminiExpressionCardResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    expression: { type: SchemaType.STRING },
    source_line: { type: SchemaType.STRING },
    timestamp: { type: SchemaType.STRING },
    natural_meaning_ko: { type: SchemaType.STRING },
    story: { type: SchemaType.STRING },
    pronunciation: {
      type: SchemaType.OBJECT,
      properties: {
        stress: { type: SchemaType.STRING },
        linking: { type: SchemaType.STRING },
        trap_ko: { type: SchemaType.STRING },
        ipa: { type: SchemaType.STRING },
        say_it_ko: { type: SchemaType.STRING },
        drill: { type: SchemaType.STRING },
      },
      required: ["stress", "linking", "trap_ko", "ipa", "say_it_ko", "drill"],
    },
    variations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          en: { type: SchemaType.STRING },
          when_ko: { type: SchemaType.STRING },
        },
        required: ["en", "when_ko"],
      },
    },
    saved_atoms: {
      type: SchemaType.OBJECT,
      properties: {
        headword: { type: SchemaType.STRING },
        one_line_nuance_ko: { type: SchemaType.STRING },
        register_ko: { type: SchemaType.STRING },
        examples: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          minItems: 1,
        },
      },
      required: ["headword", "one_line_nuance_ko", "register_ko", "examples"],
    },
  },
  required: [
    "expression",
    "source_line",
    "timestamp",
    "natural_meaning_ko",
    "story",
    "pronunciation",
    "variations",
    "saved_atoms",
  ],
};

const azureExpressionCardJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    expression: { type: "string" },
    source_line: { type: "string" },
    timestamp: { type: "string" },
    natural_meaning_ko: { type: "string" },
    story: { type: "string" },
    pronunciation: {
      type: "object",
      additionalProperties: false,
      properties: {
        stress: { type: "string" },
        linking: { type: "string" },
        trap_ko: { type: "string" },
        ipa: { type: "string" },
        say_it_ko: { type: "string" },
        drill: { type: "string" },
      },
      required: ["stress", "linking", "trap_ko", "ipa", "say_it_ko", "drill"],
    },
    variations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          en: { type: "string" },
          when_ko: { type: "string" },
        },
        required: ["en", "when_ko"],
      },
    },
    saved_atoms: {
      type: "object",
      additionalProperties: false,
      properties: {
        headword: { type: "string" },
        one_line_nuance_ko: { type: "string" },
        register_ko: { type: "string" },
        examples: {
          type: "array",
          minItems: 1,
          items: { type: "string" },
        },
      },
      required: ["headword", "one_line_nuance_ko", "register_ko", "examples"],
    },
  },
  required: [
    "expression",
    "source_line",
    "timestamp",
    "natural_meaning_ko",
    "story",
    "pronunciation",
    "variations",
    "saved_atoms",
  ],
} as const;

// @MX:NOTE: [AUTO] LLM provider wrappers for expression card generation.
// Thin wrappers around shared llm-utils; model guard enforces promoted-model policy.

function getPremiumExpressionGeminiModel() {
  return process.env.PREMIUM_EXPRESSION_MODEL || "gemini-2.5-pro";
}

function assertPromotedExpressionModel(model: string) {
  if (/flash/i.test(model)) {
    throw new Error(
      "Premium expression generation must use a promoted model; Flash models are not allowed",
    );
  }
}

function isPromotedModelConfigurationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Flash models are not allowed/i.test(error.message)
  );
}

async function generateWithAzureOpenAI(prompt: string) {
  const config = getAzureOpenAIConfig("PREMIUM_EXPRESSION_AZURE_DEPLOYMENT");
  if (!config) return null;

  const result = await callAzureOpenAI(
    prompt,
    config,
    "You are the premium InputEnglish expression-card editor. Return only valid JSON that matches the requested schema.",
    "premium_expression_card",
    azureExpressionCardJsonSchema as unknown as Record<string, unknown>,
    0.4,
  );
  return { ...result, provider: "azure-openai" as const };
}

async function generateWithGemini(prompt: string) {
  const modelName = getPremiumExpressionGeminiModel();
  assertPromotedExpressionModel(modelName);

  const result = await callGeminiWithSchema(
    prompt,
    modelName,
    geminiExpressionCardResponseSchema,
  );
  if (!result) return null;
  return { ...result, provider: "gemini" as const };
}

export function hasPremiumExpressionModelConfig() {
  return Boolean(
    getAzureOpenAIConfig("PREMIUM_EXPRESSION_AZURE_DEPLOYMENT") ||
    process.env.GEMINI_API_KEY,
  );
}

export async function generatePremiumExpressionCard(
  input: PremiumExpressionCardRequest,
): Promise<PremiumExpressionGenerationResult> {
  const prompt = buildExpressionCardPrompt(input);
  const generation =
    (await generateWithAzureOpenAI(prompt)) ??
    (await generateWithGemini(prompt));

  if (!generation) {
    throw new Error("Premium expression model is not configured");
  }

  return {
    card: parseAiExpressionCard(generation.text, input.depth),
    meta: {
      promptVersion: PREMIUM_EXPRESSION_PROMPT_VERSION,
      provider: generation.provider,
      model: generation.model,
    },
  };
}

function formatSeconds(value: number): string {
  const rounded = Math.max(0, Math.round(value));
  const minutes = `${Math.floor(rounded / 60)}`.padStart(2, "0");
  const seconds = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function normalizeExpressionCandidate(
  text: string,
  depth: PremiumExpressionDepth,
) {
  const words = text
    .replace(/[“”"().,!?;:]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const count = depth === "anchor" ? 4 : 3;
  return words.slice(0, Math.min(count, words.length)).join(" ");
}

function selectAnchorLine(session: PremiumSessionDraftInput) {
  const deliveryLineId = session.delivery_analysis[0]?.line_id;
  return (
    session.transcript.find((line) => line.id === deliveryLineId) ??
    session.transcript.reduce((best, line) =>
      line.text.length > best.text.length ? line : best,
    )
  );
}

function selectSupportLines(
  session: PremiumSessionDraftInput,
  anchorLine: PremiumTranscriptLine,
) {
  return session.transcript
    .filter((line) => line.id !== anchorLine.id)
    .slice(0, 2);
}

function buildPipelineExpressionRequest(
  session: PremiumSessionDraftInput,
  line: PremiumTranscriptLine,
  depth: PremiumExpressionDepth,
): PremiumExpressionCardRequest {
  return {
    expression: normalizeExpressionCandidate(line.text, depth),
    sourceLine: line.text,
    timestamp: formatSeconds(line.startTime),
    speaker: session.speaker_name || session.channel_name || "Source speaker",
    videoContext: [
      session.title,
      session.article.subtitle,
      session.article.body.slice(0, 320),
    ]
      .filter(Boolean)
      .join("\n"),
    transcriptExcerpt: session.transcript
      .filter(
        (candidate) =>
          candidate.startTime >= line.startTime - 15 &&
          candidate.endTime <= line.endTime + 15,
      )
      .map((candidate) => candidate.text)
      .join("\n"),
    userProfile:
      "외국계 회사와 전문직 현장에서 바로 쓸 수 있는 표현을 원하는 성인 학습자",
    depth,
  };
}

function buildFallbackExpressionCard(input: {
  session: PremiumSessionDraftInput;
  line: PremiumTranscriptLine;
  depth: PremiumExpressionDepth;
  orderIndex: number;
}): PremiumExpressionCard {
  const request = buildPipelineExpressionRequest(
    input.session,
    input.line,
    input.depth,
  );
  return premiumExpressionCardSchema.parse({
    id: `expr-${input.depth}-${input.line.id}`,
    source_sentence_id: input.line.id,
    order_index: input.orderIndex,
    depth: input.depth,
    expression: request.expression,
    source_line: input.line.text,
    timestamp: request.timestamp,
    natural_meaning_ko:
      input.depth === "anchor"
        ? "운영자가 발행 전에 문맥에 맞춰 다듬어야 할 핵심 표현 초안"
        : "운영자가 발행 전에 문맥에 맞춰 다듬어야 할 보조 표현 초안",
    story:
      input.depth === "anchor"
        ? `**${request.expression}**는 이 장면에서 학습자가 먼저 검수해야 할 핵심 덩어리입니다. 원문과 영상 톤을 확인한 뒤, 실제 회의나 발표에서 쓸 수 있는 문장으로 다듬어야 합니다.`
        : `**${request.expression}**는 anchor를 받쳐 주는 보조 덩어리입니다. 문맥이 약하면 발행 전에 삭제하거나 더 자연스러운 표현으로 교체해야 합니다.`,
    pronunciation: {
      stress: request.expression.split(/\s+/)[0] ?? request.expression,
      linking: "운영자가 영상 발화를 듣고 연음 포인트를 검수해야 합니다.",
      trap_ko: "원문 오디오 없이 과장된 한국어식 소리를 적지 않습니다.",
      ipa: "/review-needed/",
      say_it_ko: "원문 발화를 듣고 검수 후 입력",
      drill: input.line.text,
    },
    variations:
      input.depth === "anchor"
        ? [
            {
              en: input.line.text,
              when_ko: "원문 장면과 같은 상황에서 먼저 검수할 예문.",
            },
          ]
        : [],
    saved_atoms: {
      headword: request.expression,
      one_line_nuance_ko: "발행 전 사람이 뉘앙스를 확정해야 하는 초안.",
      register_ko: "검수 전",
      examples: [input.line.text],
    },
    reviewed: false,
  }) as PremiumExpressionCard;
}

function normalizePipelineExpressionCards(
  cards: PremiumSessionDraftInput["expression_cards"],
): PremiumExpressionCard[] {
  return cards.map(
    (card, index) =>
      premiumExpressionCardSchema.parse({
        ...card,
        id: card.id ?? `expr-${card.depth}-${index + 1}`,
        order_index: card.order_index ?? index,
      }) as PremiumExpressionCard,
  );
}

export async function resolvePremiumExpressionCardsForPipeline(
  session: PremiumSessionDraftInput,
): Promise<PremiumExpressionCardGenerationResolution> {
  if (session.expression_cards.length > 0) {
    return {
      source: "fallback",
      provider: null,
      model: null,
      cards: normalizePipelineExpressionCards(session.expression_cards),
    };
  }

  const anchorLine = selectAnchorLine(session);
  const cardTargets = [
    { line: anchorLine, depth: "anchor" as const },
    ...selectSupportLines(session, anchorLine).map((line) => ({
      line,
      depth: "support" as const,
    })),
  ].slice(0, 3);
  const requests = cardTargets.map(({ line, depth }) =>
    buildPipelineExpressionRequest(session, line, depth),
  );

  if (!hasPremiumExpressionModelConfig()) {
    return {
      source: "fallback",
      provider: null,
      model: null,
      cards: cardTargets.map(({ line, depth }, index) =>
        buildFallbackExpressionCard({
          session,
          line,
          depth,
          orderIndex: index,
        }),
      ),
    };
  }

  let generated: PremiumExpressionGenerationResult[];
  try {
    generated = await Promise.all(
      requests.map((request) => generatePremiumExpressionCard(request)),
    );
  } catch (error) {
    if (isPromotedModelConfigurationError(error)) {
      throw error;
    }
    return {
      source: "fallback",
      provider: null,
      model: null,
      cards: cardTargets.map(({ line, depth }, index) =>
        buildFallbackExpressionCard({
          session,
          line,
          depth,
          orderIndex: index,
        }),
      ),
    };
  }

  return {
    source: "ai",
    provider: generated[0].meta.provider,
    model: generated[0].meta.model,
    cards: generated.map(
      (result, index) =>
        premiumExpressionCardSchema.parse({
          ...result.card,
          id: `expr-${result.card.depth}-${index + 1}`,
          source_sentence_id: cardTargets[index]?.line.id ?? anchorLine.id,
          order_index: index,
          reviewed: false,
        }) as PremiumExpressionCard,
    ),
  };
}
