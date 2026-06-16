import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const getMonthlyQuestionCount = vi.fn();
const getCapStatus = vi.fn();
const selectQuestionModel = vi.fn();
const callGeminiWithSchema = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
}));

vi.mock("@/lib/premium/entitlement", () => ({
  resolvePremiumEntitlement: (...args: unknown[]) =>
    resolvePremiumEntitlement(...args),
}));

vi.mock("@/lib/premium/question-cap", () => ({
  getMonthlyQuestionCount: (...args: unknown[]) =>
    getMonthlyQuestionCount(...args),
  getCapStatus: (...args: unknown[]) => getCapStatus(...args),
  selectQuestionModel: (...args: unknown[]) => selectQuestionModel(...args),
  MONTHLY_QUESTION_CAP: 100,
}));

vi.mock("@/lib/premium/llm-utils", () => ({
  callGeminiWithSchema: (...args: unknown[]) => callGeminiWithSchema(...args),
}));

// Mock Supabase admin client for persistence
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
  createClient: vi.fn(),
}));

const user = { id: "user-123" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};
const expiredEntitlement = {
  hasAccess: false,
  plan: "FREE",
  reason: "trial-expired",
  trialEndsAt: "2026-06-01T00:00:00.000Z",
};

const validBody = {
  highlightText: "run the gamut",
  question: "What does this phrase mean?",
  sourceType: "reading" as const,
  sourceRef: { type: "reading" as const, pieceId: "piece-001" },
};

describe("POST /api/premium/question", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    getCapStatus.mockReset();
    selectQuestionModel.mockReset();
    callGeminiWithSchema.mockReset();
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockGte.mockClear();

    // Default: from('asked_items').insert(...) returns no error
    mockInsert.mockResolvedValue({ error: null });
    // Default: from('asked_items').select(...).eq(...).gte(...) returns count=0
    mockGte.mockResolvedValue({ count: 0, error: null });
    mockEq.mockReturnValue({ gte: mockGte });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockImplementation((table: string) => {
      if (table === "asked_items") {
        return {
          select: mockSelect,
          insert: mockInsert,
        };
      }
      return { select: mockSelect, insert: mockInsert };
    });
  });

  it("returns 402 when request has no auth (user not entitled)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(expiredEntitlement);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(402);
  });

  it("returns 401 when requireApiUser returns 401 response", async () => {
    requireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 with flash model and capNotice when cap is exceeded (soft cap - not hard block)", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(100);
    getCapStatus.mockReturnValue({
      remaining: 0,
      isExceeded: true,
      notice:
        "이번 달 질문 횟수를 모두 사용했어요. 다음 달에 다시 이용할 수 있어요.",
    });
    selectQuestionModel.mockReturnValue("gemini-2.5-flash");
    callGeminiWithSchema.mockResolvedValue({
      text: JSON.stringify({ answer: "This phrase means to cover a range." }),
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      answer: string;
      model: string;
      remainingCap: number;
      capNotice?: string;
    };
    expect(data.model).toBe("gemini-2.5-flash");
    expect(data.remainingCap).toBe(0);
    expect(data.capNotice).toContain("모두 사용");
    expect(data.answer).toBeTruthy();
  });

  it("returns 200 with flash model for a short question", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(10);
    getCapStatus.mockReturnValue({
      remaining: 90,
      isExceeded: false,
      notice: undefined,
    });
    selectQuestionModel.mockReturnValue("gemini-2.5-flash");
    callGeminiWithSchema.mockResolvedValue({
      text: JSON.stringify({
        answer: "It means to span a full range of things.",
      }),
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, question: "short question" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      answer: string;
      model: string;
      remainingCap: number;
      capNotice?: string;
    };
    expect(data.model).toBe("gemini-2.5-flash");
    expect(data.remainingCap).toBe(90);
    expect(data.capNotice).toBeUndefined();
  });

  it("passes the highlight context into the LLM prompt when provided", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);
    getMonthlyQuestionCount.mockResolvedValue(5);
    getCapStatus.mockReturnValue({
      remaining: 95,
      isExceeded: false,
      notice: undefined,
    });
    selectQuestionModel.mockReturnValue("gemini-2.5-flash");
    callGeminiWithSchema.mockResolvedValue({
      text: JSON.stringify({
        answer: "여기서는 다양한 범위를 아우른다는 뜻이에요.",
      }),
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

    const context = "Their tastes run the gamut from jazz to techno.";
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, context }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(callGeminiWithSchema).toHaveBeenCalledTimes(1);
    const promptArg = callGeminiWithSchema.mock.calls[0][0] as string;
    expect(promptArg).toContain(context);
    expect(promptArg).toContain("run the gamut");
    // The refined prompt forbids English answers.
    expect(promptArg).toContain("절대 영어로 답하지 마");
  });

  it("returns 400 for missing required fields", async () => {
    requireApiUser.mockResolvedValue(user);
    resolvePremiumEntitlement.mockResolvedValue(premiumEntitlement);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightText: "test" }), // missing question, sourceType, sourceRef
      }) as never,
    );

    expect(response.status).toBe(400);
  });
});
