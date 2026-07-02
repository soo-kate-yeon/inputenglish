// @MX:NOTE: [AUTO] Client-side GET helper for /api/premium/today (Task 5.2). Unlike
//   postJson (onboarding), this deliberately does NOT throw on non-2xx: 402
//   (entitlement gate) and 500 are valid, renderable outcomes that
//   buildLearningHomeViewModel maps to their own view states.
import type { TodayApiResult } from "./learning-home-view-model";

export async function fetchTodaySession(): Promise<TodayApiResult> {
  const response = await fetch("/api/premium/today", {
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  });

  const body = await response.json();
  return { status: response.status, body };
}
