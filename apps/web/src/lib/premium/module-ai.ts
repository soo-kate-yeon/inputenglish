import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import { buildPremiumAntiSlopVoiceRules } from "@inputenglish/shared";
import { z } from "zod";
import type { PremiumSessionDraftInput } from "@/lib/premium/session-schema";
import {
  premiumArticleSchema,
  premiumRoleplaySchema,
  premiumSessionDraftSchema,
} from "@/lib/premium/session-schema";

export const premiumGeneratedModulesSchema = z.object({
  article: premiumArticleSchema,
  roleplay: premiumRoleplaySchema,
});

export type PremiumGeneratedModules = z.infer<
  typeof premiumGeneratedModulesSchema
>;

export type PremiumModuleGenerationResolution =
  | {
      source: "ai";
      provider: "azure-openai" | "gemini";
      model: string;
      modules: PremiumGeneratedModules;
    }
  | {
      source: "fallback";
      provider: null;
      model: null;
      modules: null;
    };

const geminiModuleResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    article: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        subtitle: { type: SchemaType.STRING },
        body: { type: SchemaType.STRING },
        summary_bullets: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        reading_minutes: { type: SchemaType.INTEGER },
        reviewed: { type: SchemaType.BOOLEAN },
      },
      required: [
        "title",
        "subtitle",
        "body",
        "summary_bullets",
        "reading_minutes",
        "reviewed",
      ],
    },
    roleplay: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        situation: { type: SchemaType.STRING },
        user_role: { type: SchemaType.STRING },
        partner_role: { type: SchemaType.STRING },
        target_expression_ids: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        turns: {
          type: SchemaType.ARRAY,
          minItems: 2,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              speaker: {
                type: SchemaType.STRING,
                format: "enum",
                enum: ["coach", "user"],
              },
              avatar_label: { type: SchemaType.STRING },
              line: { type: SchemaType.STRING },
              translation: { type: SchemaType.STRING },
              hidden: { type: SchemaType.BOOLEAN },
              reference_text: { type: SchemaType.STRING },
              expression_ids: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
            },
            required: ["id", "speaker", "translation", "expression_ids"],
          },
        },
        analysis_reference_text: { type: SchemaType.STRING },
        reviewed: { type: SchemaType.BOOLEAN },
      },
      required: [
        "title",
        "situation",
        "user_role",
        "partner_role",
        "target_expression_ids",
        "turns",
        "analysis_reference_text",
        "reviewed",
      ],
    },
  },
  required: ["article", "roleplay"],
};

const azureModuleJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    article: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        body: { type: "string" },
        summary_bullets: {
          type: "array",
          items: { type: "string" },
        },
        reading_minutes: { type: "integer" },
        reviewed: { type: "boolean" },
      },
      required: [
        "title",
        "subtitle",
        "body",
        "summary_bullets",
        "reading_minutes",
        "reviewed",
      ],
    },
    roleplay: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        situation: { type: "string" },
        user_role: { type: "string" },
        partner_role: { type: "string" },
        target_expression_ids: {
          type: "array",
          items: { type: "string" },
        },
        turns: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              speaker: { type: "string", enum: ["coach", "user"] },
              avatar_label: { type: "string" },
              line: { type: "string" },
              translation: { type: "string" },
              hidden: { type: "boolean" },
              reference_text: { type: "string" },
              expression_ids: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["id", "speaker", "translation", "expression_ids"],
          },
        },
        analysis_reference_text: { type: "string" },
        reviewed: { type: "boolean" },
      },
      required: [
        "title",
        "situation",
        "user_role",
        "partner_role",
        "target_expression_ids",
        "turns",
        "analysis_reference_text",
        "reviewed",
      ],
    },
  },
  required: ["article", "roleplay"],
} as const;

function getAzureModuleConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment =
    process.env.PREMIUM_MODULE_AZURE_DEPLOYMENT ||
    process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, deployment, apiVersion };
}

function getGeminiModuleModel() {
  return process.env.PREMIUM_MODULE_MODEL || "gemini-2.5-pro";
}

function assertPromotedModuleModel(model: string) {
  if (/flash/i.test(model)) {
    throw new Error(
      "Premium module generation must use a promoted model; Flash models are not allowed",
    );
  }
}

function formatTranscript(session: PremiumSessionDraftInput) {
  return session.transcript
    .map(
      (line) =>
        `${line.id} | ${line.startTime.toFixed(2)}-${line.endTime.toFixed(2)} | ${line.text}`,
    )
    .join("\n");
}

function formatExpressionCards(session: PremiumSessionDraftInput) {
  if (!session.expression_cards.length) return "(none yet)";
  return session.expression_cards
    .map((card) => {
      const id = card.id ?? card.expression;
      return [
        `${id} | ${card.depth} | expression: ${card.expression}`,
        `meaning_ko: ${card.natural_meaning_ko}`,
        `source_line: ${card.source_line}`,
      ].join(" | ");
    })
    .join("\n");
}

function normalizeExpressionMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”"'.!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textContainsExpression(text: string, expression: string) {
  const normalizedText = normalizeExpressionMatch(text);
  const normalizedExpression = normalizeExpressionMatch(expression);
  return (
    normalizedExpression.length > 0 &&
    normalizedText.includes(normalizedExpression)
  );
}

export function buildPremiumModulePrompt(session: PremiumSessionDraftInput) {
  const expressionIds = session.expression_cards.map(
    (card) => card.id ?? card.expression,
  );

  return [
    "You are generating the editorial modules for one InputEnglish premium lesson draft.",
    "Return one valid JSON object with article and roleplay. Do not include expression cards or delivery analysis.",
    "All reviewed fields must be false because a human operator must approve before publish.",
    "Use the selected cropped transcript only.",
    "The admin does not create listening or pronunciation analysis. User speech will be analyzed at runtime through Azure after the learner records a roleplay line.",
    "Roleplay must include at least one coach turn and one hidden user turn with reference_text.",
    "Every roleplay turn must include a natural Korean translation for the in-stage translation toggle.",
    "If expression cards exist, the hidden user reference_text must be a natural sentence the learner can say that contains the selected anchor expression text.",
    "Do not only talk about the same meaning. Make the learner actually use the target expression in reference_text.",
    "Set roleplay.target_expression_ids and the hidden user turn expression_ids to the expression card ids that are actually used in reference_text.",
    "Do not force a mechanical ABAB exchange. You may create a small scene with multiple non-user characters before the learner speaks.",
    "Use speaker='coach' for all non-user characters and distinguish them with avatar_label such as 'A', 'B', 'Manager', or 'Teammate'.",
    "Use speaker='user' for the learner, preferably as a third participant C who is asked to respond after A/B context is established.",
    "A strong roleplay can be A/B setting up context, then B asking the user/C for a natural response using the target expression.",
    "Keep roleplay turns compact: usually 3-5 turns total, with exactly one clear hidden user turn when possible.",
    "Premium voice rules for every generated article, translation, and roleplay line:",
    buildPremiumAntiSlopVoiceRules(),
    "",
    `title: ${session.title}`,
    `source_url: ${session.source_url}`,
    `segment: ${session.segment_start_time}-${session.segment_end_time}`,
    `expression_ids: ${expressionIds.join(", ") || "(none yet)"}`,
    "",
    "expression_cards:",
    formatExpressionCards(session),
    "",
    "transcript:",
    formatTranscript(session),
    "",
    "JSON shape:",
    '{"article":{"title":"","subtitle":"","body":"","summary_bullets":[],"reading_minutes":2,"reviewed":false},"roleplay":{"title":"","situation":"","user_role":"학습자","partner_role":"대화 상대","target_expression_ids":[],"turns":[{"id":"roleplay-a-1","speaker":"coach","avatar_label":"A","line":"","translation":"","expression_ids":[]},{"id":"roleplay-b-1","speaker":"coach","avatar_label":"B","line":"","translation":"","expression_ids":[]},{"id":"roleplay-user-1","speaker":"user","avatar_label":"C","hidden":true,"translation":"","reference_text":"","expression_ids":[]}],"analysis_reference_text":"","reviewed":false}}',
  ].join("\n");
}

function parsePremiumModuleOutput(
  raw: string,
  session: PremiumSessionDraftInput,
): PremiumGeneratedModules {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const modules = premiumGeneratedModulesSchema.parse(JSON.parse(cleaned));
  const cardIds = new Set(
    session.expression_cards
      .flatMap((card) => [card.id, card.expression])
      .filter(Boolean),
  );

  const hasUserReference = modules.roleplay.turns.some(
    (turn) => turn.speaker === "user" && turn.reference_text?.trim(),
  );
  if (!modules.roleplay.analysis_reference_text?.trim() && !hasUserReference) {
    throw new Error("AI roleplay must include analysis reference text");
  }

  const missingTranslation = modules.roleplay.turns.find(
    (turn) => !turn.translation?.trim(),
  );
  if (missingTranslation) {
    throw new Error("AI roleplay turns must include Korean translations");
  }

  modules.roleplay.target_expression_ids.forEach((expressionId) => {
    if (cardIds.size > 0 && !cardIds.has(expressionId)) {
      throw new Error(
        `AI roleplay target expression ${expressionId} is not in expression cards`,
      );
    }
  });

  const userReferenceText = modules.roleplay.turns
    .filter((turn) => turn.speaker === "user")
    .map((turn) => turn.reference_text ?? "")
    .join("\n");
  const targetIds = new Set([
    ...modules.roleplay.target_expression_ids,
    ...modules.roleplay.turns.flatMap((turn) => turn.expression_ids ?? []),
  ]);
  const selectedAnchorCard =
    session.expression_cards.find(
      (card) =>
        card.depth === "anchor" &&
        (targetIds.has(card.id ?? "") || targetIds.has(card.expression)),
    ) ?? session.expression_cards.find((card) => card.depth === "anchor");

  if (
    selectedAnchorCard &&
    !textContainsExpression(userReferenceText, selectedAnchorCard.expression)
  ) {
    throw new Error(
      `AI roleplay reference_text must contain anchor expression ${selectedAnchorCard.expression}`,
    );
  }

  return {
    article: { ...modules.article, reviewed: false },
    roleplay: { ...modules.roleplay, reviewed: false },
  };
}

async function generateModulesWithAzureOpenAI(prompt: string) {
  const config = getAzureModuleConfig();
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
              "You are the InputEnglish premium module editor. Return only one valid JSON object.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.35,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "premium_session_modules",
            strict: true,
            schema: azureModuleJsonSchema,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Azure OpenAI module generation failed: ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Azure OpenAI module generation returned no content");
  }

  return {
    text: content,
    provider: "azure-openai" as const,
    model: config.deployment,
  };
}

async function generateModulesWithGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelName = getGeminiModuleModel();
  assertPromotedModuleModel(modelName);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: geminiModuleResponseSchema,
    },
  });

  const result = await model.generateContent(prompt);
  return {
    text: result.response.text(),
    provider: "gemini" as const,
    model: modelName,
  };
}

export async function resolvePremiumModulesForPipeline(
  session: PremiumSessionDraftInput,
): Promise<PremiumModuleGenerationResolution> {
  const prompt = buildPremiumModulePrompt(session);
  const generation =
    (await generateModulesWithAzureOpenAI(prompt)) ??
    (await generateModulesWithGemini(prompt));

  if (!generation) {
    return {
      source: "fallback",
      provider: null,
      model: null,
      modules: null,
    };
  }

  return {
    source: "ai",
    provider: generation.provider,
    model: generation.model,
    modules: parsePremiumModuleOutput(generation.text, session),
  };
}

export function applyPremiumGeneratedModules(
  session: PremiumSessionDraftInput,
  modules: PremiumGeneratedModules,
): PremiumSessionDraftInput {
  return premiumSessionDraftSchema.parse({
    ...session,
    article: modules.article,
    roleplay: modules.roleplay,
  });
}
