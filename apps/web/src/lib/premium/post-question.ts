// @MX:NOTE: [AUTO] Client-side POST helper for /api/premium/question (Task 5.3/5.5).
//   Mirrors fetch-today-session.ts's non-throwing status/body contract — a 402
//   (entitlement gate) or a soft-cap 200 with dailyCapNotice must be rendered by
//   the caller, not thrown away.
import type { AskedItemSourceRef } from "@inputenglish/shared";

export interface PostQuestionParams {
  highlightText: string;
  question: string;
  context?: string;
  sourceType: "reading" | "segment";
  sourceRef: AskedItemSourceRef;
}

export interface PostQuestionResult {
  status: number;
  body: {
    answer?: string;
    model?: string;
    remainingCap?: number;
    capNotice?: string;
    remainingDailyCap?: number;
    dailyCapNotice?: string;
    error?: string;
  };
}

export async function postQuestion(
  params: PostQuestionParams,
): Promise<PostQuestionResult> {
  const response = await fetch("/api/premium/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const body = await response.json();
  return { status: response.status, body };
}
