import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const selectQuestionModel = vi.fn();
const callGeminiWithSchema = vi.fn();

vi.mock("@/lib/premium/question-cap", () => ({
  selectQuestionModel: (...args: unknown[]) => selectQuestionModel(...args),
}));

vi.mock("@/lib/premium/llm-utils", () => ({
  callGeminiWithSchema: (...args: unknown[]) => callGeminiWithSchema(...args),
}));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/dev/question-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

type PreviewBody = {
  answer?: string;
  model?: string;
  prompt?: string;
  context?: string | null;
  error?: string;
};

describe("/api/dev/question-preview", () => {
  beforeEach(() => {
    vi.resetModules();
    selectQuestionModel.mockReset();
    callGeminiWithSchema.mockReset();
    selectQuestionModel.mockReturnValue("gemini-2.5-flash");
    callGeminiWithSchema.mockResolvedValue({
      text: JSON.stringify({
        answer: "여기서는 다양한 범위를 아우른다는 뜻이에요.",
      }),
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the answer, model, and the exact prompt sent to the LLM", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({
        highlightText: "run the gamut",
        question: "이게 무슨 뜻이야?",
        context: "Their tastes run the gamut from jazz to techno.",
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as PreviewBody;
    expect(data.answer).toContain("범위");
    expect(data.model).toBe("gemini-2.5-flash");
    expect(data.prompt).toContain(
      "Their tastes run the gamut from jazz to techno.",
    );
    expect(data.prompt).toContain("절대 영어로 답하지 마");
    expect(callGeminiWithSchema).toHaveBeenCalledTimes(1);
  });

  it("honors an explicit model override (skips Flash-gate selection)", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({ highlightText: "serendipity", model: "gemini-2.5-pro" }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as PreviewBody;
    expect(data.model).toBe("gemini-2.5-pro");
    expect(selectQuestionModel).not.toHaveBeenCalled();
  });

  it("returns 404 in production (gating prevents prod exposure)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("./route");
    const response = await POST(postRequest({ highlightText: "anything" }));

    expect(response.status).toBe(404);
    expect(callGeminiWithSchema).not.toHaveBeenCalled();
  });

  it("returns 400 when highlightText is missing", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ question: "뭐야?" }));

    expect(response.status).toBe(400);
  });
});
