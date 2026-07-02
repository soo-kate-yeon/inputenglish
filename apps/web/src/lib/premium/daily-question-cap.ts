// @MX:NOTE: [AUTO] Daily question cap (D15, REQ-WEB-004-W2/U4) — a NEW, parallel mechanism
//   to the existing monthly question-cap.ts (SPEC-INPUT-001, MONTHLY_QUESTION_CAP=100,
//   INVIOLABLE KEEP, untouched by this module). Uses the daily_question_counts table
//   (Phase 0 migration: user_id, date, count, UNIQUE(user_id, date)) rather than counting
//   asked_items directly, so a day's count survives independent of asked_items retention
//   policy and matches the Phase 0 schema's intended shape.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.5 (REQ-WEB-004-W2/U4, D15, AC-004-3, EC-004-B)
import type { SupabaseClient } from "@supabase/supabase-js";

/** D15: hard daily cap per content — soft, never a hard block. */
export const DAILY_QUESTION_CAP = 10;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns today's question count for the user (0 if no row exists yet).
 */
export async function getDailyQuestionCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("daily_question_counts")
    .select("count")
    .eq("user_id", userId)
    .eq("date", today())
    .maybeSingle();

  return (data as { count?: number } | null)?.count ?? 0;
}

/**
 * Upserts today's row, incrementing count by 1, and returns the new count.
 *
 * Takes the caller's already-known `currentCount` (from a prior
 * getDailyQuestionCount call in the same request) instead of re-fetching it,
 * avoiding a redundant SELECT — callers that check the cap status before
 * asking a question already have this value on hand.
 */
export async function incrementDailyQuestionCount(
  supabase: SupabaseClient,
  userId: string,
  currentCount: number,
): Promise<number> {
  const nextCount = currentCount + 1;

  const { data } = await supabase
    .from("daily_question_counts")
    .upsert(
      { user_id: userId, date: today(), count: nextCount },
      { onConflict: "user_id,date" },
    )
    .select("count")
    .maybeSingle();

  return (data as { count?: number } | null)?.count ?? nextCount;
}

/**
 * Returns remaining capacity, exceeded flag, and optional user-facing notice.
 *
 * D15 (soft cap): the 10th question is still served (remaining=0, not
 * exceeded). Only the 11th+ question is "exceeded" — and even then, the
 * notice is a graceful "다음 날 다시" message, never a hard-block wording
 * (EC-004-B).
 */
export function getDailyCapStatus(count: number): {
  remaining: number;
  isExceeded: boolean;
  notice: string | undefined;
} {
  const remaining = Math.max(0, DAILY_QUESTION_CAP - count);
  const isExceeded = count > DAILY_QUESTION_CAP;

  return {
    remaining,
    isExceeded,
    notice: isExceeded
      ? "오늘 질문 횟수를 모두 사용했어요. 내일 다시 이용할 수 있어요."
      : remaining <= 1
        ? `오늘 질문 ${remaining}개 남음`
        : undefined,
  };
}
