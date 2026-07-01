// @MX:ANCHOR: [AUTO] POST /api/billing/webhook — Toss webhook receiver.
// @MX:REASON: [AUTO] Signature verification (verifyWebhookSignature) runs on the RAW body
//   BEFORE any JSON.parse or DB mutation — an invalid signature returns 401 with ZERO state
//   change (see webhook-verify.ts). Idempotency is achieved by reusing subscriptions.order_id
//   (Task 2.2b unique index) rather than a separate event-id column: every webhook we handle
//   carries the original orderId, and a redelivered webhook whose target status already
//   matches the current row is treated as a no-op (no redundant DB write). On a verified,
//   state-changing event, subscriptions.status and users.plan are synced together. This route
//   never mutates expiry_date/next_renewal_date — extending the paid period on a successful
//   renewal charge is lib/billing/renewal.ts's responsibility (Phase 8 wiring), not this route's.
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.5

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/server";
import { verifyWebhookSignature } from "@/lib/billing/webhook-verify";
import {
  findSubscriptionByOrderId,
  updateSubscriptionStatus,
} from "@/lib/billing/subscription-repository";
import { withOptionalWarning } from "@/lib/billing/response-helpers";

type SubscriptionStatus = "active" | "expired" | "cancelled";

interface WebhookEvent {
  orderId: string;
  subscriptionStatus: SubscriptionStatus;
  userPlan: "FREE" | "PREMIUM";
}

const webhookPayloadSchema = z.object({
  data: z.object({
    orderId: z.string().min(1),
    status: z.string(),
  }),
});

/** Maps a Toss payment status string to our internal subscription/user plan state. */
function mapTossStatusToEvent(
  orderId: string,
  tossStatus: string,
): WebhookEvent | null {
  switch (tossStatus) {
    case "DONE":
      return { orderId, subscriptionStatus: "active", userPlan: "PREMIUM" };
    case "CANCELED":
      return { orderId, subscriptionStatus: "cancelled", userPlan: "FREE" };
    case "EXPIRED":
      return { orderId, subscriptionStatus: "expired", userPlan: "FREE" };
    default:
      return null;
  }
}

function parseWebhookPayload(raw: unknown): WebhookEvent | null {
  const parseResult = webhookPayloadSchema.safeParse(raw);
  if (!parseResult.success) return null;

  const { orderId, status } = parseResult.data.data;
  return mapTossStatusToEvent(orderId, status);
}

/**
 * POST /api/billing/webhook
 *
 * Receives Toss payment/subscription status-change webhooks.
 *
 * Response (200): { ok: true }
 * Error responses:
 *   401 — invalid or missing signature (zero state change)
 *   400 — malformed or unrecognized payload
 *   404 — no subscription matches the webhook's orderId
 *   500 — unexpected processing error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Read raw body and verify signature BEFORE any parsing/mutation ──
  const rawBody = await request.text();
  const signature = request.headers.get("toss-signature");

  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signature);
  } catch {
    // Misconfiguration (TOSS_WEBHOOK_SECRET unset) — treat as unverifiable, not a 401
    // masquerading as a legitimate rejection.
    return NextResponse.json(
      { error: "Webhook verification is not configured" },
      { status: 500 },
    );
  }

  if (!signatureValid) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // ── Step 2: Parse the verified payload ─────────────────────────────────────
  let payloadRaw: unknown;
  try {
    payloadRaw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseWebhookPayload(payloadRaw);
  if (!event) {
    return NextResponse.json(
      { error: "Malformed or unrecognized webhook payload" },
      { status: 400 },
    );
  }

  // ── Step 3: Locate the subscription by orderId ─────────────────────────────
  const client = createAdminClient();
  const subscription = await findSubscriptionByOrderId(client, event.orderId);
  if (!subscription) {
    return NextResponse.json(
      { error: "No subscription found for this orderId" },
      { status: 404 },
    );
  }

  // ── Step 4: Idempotent no-op when status already matches (redelivery) ──────
  if (subscription.status === event.subscriptionStatus) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── Step 5: Sync subscriptions.status and users.plan together ─────────────
  try {
    await updateSubscriptionStatus(
      client,
      subscription.id,
      event.subscriptionStatus,
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to update subscription status";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: userUpdateError } = await client
    .from("users")
    .update({ plan: event.userPlan })
    .eq("id", subscription.user_id);

  return withOptionalWarning(
    { ok: true },
    userUpdateError &&
      "Subscription status synced but plan sync failed; will reconcile.",
  );
}
