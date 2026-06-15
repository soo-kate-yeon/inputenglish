// @MX:NOTE: [AUTO] Monthly question cap logic for the highlight question agent (Flash-gate D1, soft cap D3).
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-004
import type { SupabaseClient } from "@supabase/supabase-js";

export const MONTHLY_QUESTION_CAP = 100;

/**
 * Returns the number of asked_items created by the user in the current calendar month.
 */
export async function getMonthlyQuestionCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("asked_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  return count ?? 0;
}

/**
 * Returns remaining capacity, exceeded flag, and optional user-facing notice.
 */
export function getCapStatus(count: number): {
  remaining: number;
  isExceeded: boolean;
  notice: string | undefined;
} {
  const remaining = Math.max(0, MONTHLY_QUESTION_CAP - count);
  const isExceeded = count >= MONTHLY_QUESTION_CAP;

  return {
    remaining,
    isExceeded,
    notice: isExceeded
      ? "이번 달 질문 횟수를 모두 사용했어요. 다음 달에 다시 이용할 수 있어요."
      : remaining <= 10
        ? `이번 달 질문 ${remaining}개 남음`
        : undefined,
  };
}

/**
 * Determines which Gemini model to use for a question (Flash-gate D1).
 * Cap exceeded triggers forced demotion to flash regardless of complexity.
 */
export function selectQuestionModel(
  question: string,
  isCapExceeded: boolean,
): string {
  if (isCapExceeded) return "gemini-2.5-flash"; // demotion on cap exceeded
  const isComplex =
    question.length > 200 ||
    /\b(explain|why|how does|what causes)\b/i.test(question);
  return isComplex ? "gemini-2.5-pro" : "gemini-2.5-flash";
}
