// @MX:NOTE: [AUTO] Client-side GET helper for /api/premium/asked-items (Task 5.6).
import type { AskedItem } from "@inputenglish/shared";
import type { PremiumEntitlement } from "@/lib/premium/entitlement";

export interface FetchAskedItemsResult {
  status: number;
  body: {
    items?: AskedItem[];
    entitlement?: PremiumEntitlement;
    error?: string;
  };
}

export async function fetchAskedItems(): Promise<FetchAskedItemsResult> {
  const response = await fetch("/api/premium/asked-items", {
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  });

  const body = await response.json();
  return { status: response.status, body };
}
