import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";

// @MX:ANCHOR: [AUTO] Shared LLM provider utilities for Gemini and Azure OpenAI.
// @MX:REASON: Used by expression-card-ai.ts and reading-generation.ts; single source for provider config.

export interface LlmGenerationResult {
  text: string;
  provider: "gemini" | "azure-openai";
  model: string;
}

// --- Gemini ---

export function getGeminiModel(envKey: string, defaultModel: string): string {
  return process.env[envKey] ?? defaultModel;
}

export async function callGeminiWithSchema(
  prompt: string,
  modelName: string,
  responseSchema: ResponseSchema,
): Promise<LlmGenerationResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const result = await model.generateContent(prompt);
  return {
    text: result.response.text(),
    provider: "gemini",
    model: modelName,
  };
}

// --- Azure OpenAI ---

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export function getAzureOpenAIConfig(
  deploymentEnvKey?: string,
): AzureOpenAIConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment =
    (deploymentEnvKey ? process.env[deploymentEnvKey] : undefined) ??
    process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, deployment, apiVersion };
}

export async function callAzureOpenAI(
  prompt: string,
  config: AzureOpenAIConfig,
  systemPrompt: string,
  jsonSchemaName: string,
  jsonSchema: Record<string, unknown>,
  temperature = 0.4,
): Promise<LlmGenerationResult> {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: jsonSchemaName,
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Azure OpenAI request failed: ${response.status} for deployment ${config.deployment}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Azure OpenAI returned no content");
  }

  return {
    text: content,
    provider: "azure-openai",
    model: config.deployment,
  };
}
