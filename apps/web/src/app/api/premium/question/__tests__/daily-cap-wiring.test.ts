/**
 * SPEC-WEB-001 Phase 5 — Task 5.5: daily question cap wiring into
 * POST /api/premium/question (D15, REQ-WEB-004-W2/U4, AC-004-3, EC-004-B).
 *
 * The existing monthly cap (question-cap.ts, SPEC-INPUT-001) is untouched
 * and continues to gate model selection. This suite verifies the NEW daily
 * cap (daily-question-cap.ts) is additionally surfaced in the response as
 * `dailyCapNotice`/`remainingDailyCap`, using the daily_question_counts
 * table, without breaking the pre-existing monthly-cap test file's simpler
 * mock (route.test.ts) — this suite provides a fuller mock including
 * daily_question_counts so the new code path is exercised end-to-end.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
const resolvePremiumEntitlement = vi.fn();
const getMonthlyQuestionCount = vi.fn();
const getCapStatus = vi.fn();
const selectQuestionModel = vi.fn();
const callGeminiWithSchema = vi.fn();

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

let dailyRowCount = 0;

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "asked_items") {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ count: 0, error: null }) }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === "daily_question_counts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { count: dailyRowCount },
                  error: null,
                }),
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: { count: dailyRowCount + 1 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ gte: async () => ({ count: 0 }) }) }),
        insert: async () => ({ error: null }),
      };
    },
  }),
  createClient: vi.fn(),
}));

const user = { id: "user-daily-1" };
const premiumEntitlement = {
  hasAccess: true,
  plan: "PREMIUM",
  reason: "premium",
  trialEndsAt: null,
};

const validBody = {
  highlightText: "run the gamut",
  question: "What does this phrase mean?",
  sourceType: "reading" as const,
  sourceRef: { type: "reading" as const, pieceId: "piece-001" },
};

describe("POST /api/premium/question — Task 5.5 daily cap wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiUser.mockReset();
    resolvePremiumEntitlement.mockReset();
    getMonthlyQuestionCount.mockReset();
    getCapStatus.mockReset();
    selectQuestionModel.mockReset();
    callGeminiWithSchema.mockReset();
    dailyRowCount = 0;

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
      text: JSON.stringify({ answer: "It means a wide range." }),
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("surfaces a positive-framing daily notice on the 9th question of the day (1 remaining) — AC-004-3", async () => {
    // Pre-request count is 8 (8 questions already asked today); this request
    // is the 9th, so after the post-answer increment the count becomes 9.
    dailyRowCount = 8;

    const { POST } = await import("../../question/route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      remainingDailyCap: number;
      dailyCapNotice?: string;
    };
    expect(data.remainingDailyCap).toBe(1); // 9th question now used, 1 remaining
    expect(data.dailyCapNotice).toBe("오늘 질문 1개 남음");
  });

  it("soft-fails (demotes to flash) at 11th daily question — EC-004-B, never a hard block", async () => {
    // Pre-request count is 10; this request is the 11th, exceeding the cap.
    dailyRowCount = 10;

    const { POST } = await import("../../question/route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    // Soft cap: still 200, still answered — never a hard block.
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      dailyCapNotice?: string;
      model: string;
    };
    expect(data.dailyCapNotice).toContain("내일");
    expect(data.model).toBe("gemini-2.5-flash"); // demoted regardless
  });

  it("does not surface a daily notice when well under the cap", async () => {
    dailyRowCount = 2;

    const { POST } = await import("../../question/route");
    const response = await POST(
      new Request("http://localhost/api/premium/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }) as never,
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { dailyCapNotice?: string };
    expect(data.dailyCapNotice).toBeUndefined();
  });
});
