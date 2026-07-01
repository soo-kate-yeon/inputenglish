// @MX:ANCHOR: [AUTO] POST /api/billing/confirm — Toss payment confirmation entry point.
// @MX:REASON: [AUTO] This is the single mutation boundary that activates a paid subscription.
//   The client-submitted `amount` is NEVER trusted directly — it is always re-derived from
//   PLAN_PRICES_KRW (Task 2.1) and rejected on mismatch before any Toss call or DB write.
//   Idempotency is enforced via subscriptions.order_id (Task 2.2b): a re-submitted orderId
//   returns the existing row unchanged with zero additional writes/Toss calls. On success,
//   the subscriptions insert happens BEFORE the users.plan dual-write (order matters for
//   partial-failure recovery — a subscription row without plan='PREMIUM' is safely
//   re-confirmable by Cron/reconciliation, but the reverse is not). Every response is passed
//   through sanitizeSubscription() so billing_key/customer_key can never leak (Task 2.3b).
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.3

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import {
  PLAN_PRICES_KRW,
  computeExpiryDate,
  isValidPlanType,
} from "@/lib/billing/plans";
import { confirmPayment, tossErrorToResponse } from "@/lib/billing/toss-client";
import {
  findSubscriptionByOrderId,
  insertSubscription,
  sanitizeSubscription,
} from "@/lib/billing/subscription-repository";
import { withOptionalWarning } from "@/lib/billing/response-helpers";

const confirmRequestSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().finite(),
  planType: z.string(),
});

/**
 * POST /api/billing/confirm
 *
 * Confirms a Toss payment and activates a subscription.
 *
 * Request body:
 *   { paymentKey: string, orderId: string, amount: number, planType: "annual"|"semiannual"|"quarterly" }
 *
 * Response (200):
 *   { subscription: SanitizedSubscription }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid body, invalid planType, or amount does not match server-side price
 *   402 — Toss payment confirmation failed
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

  const parseResult = confirmRequestSchema.safeParse(bodyRaw);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. Required: paymentKey (string), orderId (string), amount (number), planType (string).",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }
  const parsed = parseResult.data;

  if (!isValidPlanType(parsed.planType)) {
    return NextResponse.json(
      { error: `Invalid planType "${parsed.planType}"` },
      { status: 400 },
    );
  }

  // ── Step 3: Anti-tamper — re-derive expected amount server-side ──────────
  const expectedAmount = PLAN_PRICES_KRW[parsed.planType];
  if (parsed.amount !== expectedAmount) {
    return NextResponse.json(
      { error: "Amount does not match the expected plan price" },
      { status: 400 },
    );
  }

  const client = createAdminClient();

  // ── Step 4: Idempotency — return existing subscription unchanged ─────────
  const existing = await findSubscriptionByOrderId(client, parsed.orderId);
  if (existing) {
    return NextResponse.json(
      { subscription: sanitizeSubscription(existing) },
      { status: 200 },
    );
  }

  // ── Step 5: Confirm payment with Toss ──────────────────────────────────────
  try {
    await confirmPayment({
      paymentKey: parsed.paymentKey,
      orderId: parsed.orderId,
      amount: parsed.amount,
    });
  } catch (err) {
    const { status, message } = tossErrorToResponse(
      err,
      "Payment confirmation failed",
    );
    return NextResponse.json({ error: message }, { status });
  }

  // ── Step 6: Dual-write — subscriptions insert FIRST, then users.plan update ──
  const startDate = new Date();
  const expiryDate = computeExpiryDate(parsed.planType, startDate);

  let insertedSubscription;
  try {
    insertedSubscription = await insertSubscription(client, {
      user_id: user.id,
      plan_type: parsed.planType,
      start_date: startDate.toISOString(),
      expiry_date: expiryDate.toISOString(),
      order_id: parsed.orderId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to record subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: userUpdateError } = await client
    .from("users")
    .update({ plan: "PREMIUM" })
    .eq("id", user.id);

  // Subscription row exists but the plan flag may have failed to sync — surfaced for
  // reconciliation/Cron follow-up rather than silently dropped.
  return withOptionalWarning(
    { subscription: sanitizeSubscription(insertedSubscription) },
    userUpdateError &&
      "Subscription recorded but plan sync failed; will reconcile.",
  );
}
