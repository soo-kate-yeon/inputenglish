// @MX:NOTE: [AUTO] Client-side GET helper for /api/premium/weekly-prep (Task 6.2).
//   Mirrors fetch-asked-items.ts / fetch-today-session.ts's { status, body } shape —
//   never throws on non-2xx, so callers can render 402/500 states directly.
import type { WeeklyPrep } from "@inputenglish/shared";
import type { PremiumEntitlement } from "@/lib/premium/entitlement";

export interface FetchWeeklyPrepResult {
  status: number;
  body: {
    weeklyPrep?: WeeklyPrep | null;
    entitlement?: PremiumEntitlement;
    error?: string;
  };
}

export async function fetchWeeklyPrep(): Promise<FetchWeeklyPrepResult> {
  const response = await fetch("/api/premium/weekly-prep", {
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  });

  const body = await response.json();
  return { status: response.status, body };
}
