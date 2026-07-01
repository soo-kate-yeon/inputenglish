// @MX:ANCHOR: [AUTO] POST /api/billing/issue — Toss billing-key issuance entry point.
// @MX:REASON: [AUTO] This route stores the auto-renewal billing_key on the user's active
//   subscription. The response body is a fixed { ok: true } shape ONLY — billing_key/
//   customer_key are never echoed back, even indirectly (no subscription object returned).
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.4

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import {
  issueBillingKey,
  tossErrorToResponse,
} from "@/lib/billing/toss-client";
import {
  findActiveSubscriptionByUserId,
  updateSubscriptionBillingKey,
} from "@/lib/billing/subscription-repository";

const issueRequestSchema = z.object({
  authKey: z.string().min(1),
  customerKey: z.string().min(1),
});

/**
 * POST /api/billing/issue
 *
 * Issues a Toss billing key for auto-renewal and attaches it to the user's active subscription.
 *
 * Request body:
 *   { authKey: string, customerKey: string }
 *
 * Response (200):
 *   { ok: true }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid body
 *   404 — user has no active subscription to attach the billing key to
 *   402 — Toss billing-key issuance failed
 *   500 — unexpected processing error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Auth ─────────────────────────────────────────────────────────
  const userOrResponse = await requireApiUser(request);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // 401
  }
  const user = userOrResponse;

  // ── Step 2: Parse + validate body ────────────────────────────────────────
  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = issueRequestSchema.safeParse(bodyRaw);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. Required: authKey (string), customerKey (string).",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }
  const parsed = parseResult.data;

  const client = createAdminClient();

  // ── Step 3: Locate the user's active subscription ─────────────────────────
  const subscription = await findActiveSubscriptionByUserId(client, user.id);
  if (!subscription) {
    return NextResponse.json(
      { error: "No active subscription found for this user" },
      { status: 404 },
    );
  }

  // ── Step 4: Issue billing key with Toss ────────────────────────────────────
  let issued;
  try {
    issued = await issueBillingKey({
      authKey: parsed.authKey,
      customerKey: parsed.customerKey,
    });
  } catch (err) {
    const { status, message } = tossErrorToResponse(
      err,
      "Billing key issuance failed",
    );
    return NextResponse.json({ error: message }, { status });
  }

  // ── Step 5: Persist billing_key + customer_key + next_renewal_date ────────
  // next_renewal_date is set to the subscription's own expiry_date: Task 2.7's
  // renewal function queries `next_renewal_date <= now` to trigger the auto-charge
  // just before expiry, then advances both expiry_date and next_renewal_date together.
  try {
    await updateSubscriptionBillingKey(client, subscription.id, {
      billing_key: issued.billingKey,
      customer_key: issued.customerKey,
      next_renewal_date: subscription.expiry_date,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to persist billing key";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
