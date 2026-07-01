// @MX:ANCHOR: [AUTO] Auto-renewal charge logic for Toss billing-key subscriptions.
// @MX:REASON: [AUTO] This module is intentionally decoupled from any Cron/route wiring
//   (that is Phase 8's responsibility — see JSDoc on renewExpiringSubscriptions for the
//   exact call signature Phase 8 must invoke). It is also decoupled from actual pre-notice
//   sending (Solapi/Resend, Phase 7): the optional `onChargeFailure` hook is a documented
//   interface point only — this module must NEVER perform real notification I/O itself.
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.7

import { computeExpiryDate, PLAN_PRICES_KRW, type PlanType } from "./plans";
import type { ChargeBillingKeyResponse } from "./toss-client";

/** Minimal subscription shape needed to attempt a renewal charge. */
export interface DueSubscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  expiry_date: string;
  billing_key: string;
  customer_key: string;
}

/** Parameters passed to the injected `extendSubscription` dependency on a successful charge. */
export interface ExtendSubscriptionParams {
  expiry_date: string;
  next_renewal_date: string;
  order_id: string;
}

/** Payload passed to the optional `onChargeFailure` hook — for Phase 7 pre-notice wiring only. */
export interface ChargeFailureEvent {
  subscriptionId: string;
  userId: string;
  error: string;
}

export interface RenewExpiringSubscriptionsDeps {
  /** Injectable Toss charge call — mirrors lib/billing/toss-client.ts#chargeBillingKey. */
  chargeBillingKey: (request: {
    billingKey: string;
    customerKey: string;
    amount: number;
    orderId: string;
    orderName: string;
  }) => Promise<ChargeBillingKeyResponse>;
  /**
   * Injectable query for subscriptions due for renewal. Phase 8's Cron route implementation
   * MUST supply this as: subscriptions WHERE next_renewal_date <= now() AND status='active'
   * AND billing_key IS NOT NULL.
   */
  findDueSubscriptions: () => Promise<DueSubscription[]>;
  /** Injectable persistence call — extends expiry_date/next_renewal_date on charge success. */
  extendSubscription: (
    subscriptionId: string,
    params: ExtendSubscriptionParams,
  ) => Promise<void>;
  /**
   * OPTIONAL documented hook for Phase 7 (Solapi/Resend pre-notice on renewal failure).
   * This function MUST NOT implement actual sending — it only forwards the failure event
   * to a caller-supplied implementation. Absent by default (no-op).
   */
  onChargeFailure?: (event: ChargeFailureEvent) => Promise<void>;
}

export interface RenewalFailure {
  subscriptionId: string;
  error: string;
}

export interface RenewExpiringSubscriptionsResult {
  succeeded: string[];
  failed: RenewalFailure[];
}

function buildRenewalOrderId(subscriptionId: string): string {
  return `renew-${subscriptionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Renews all subscriptions currently due for auto-renewal via their stored Toss billing_key.
 *
 * Call signature for Phase 8 (Cron wiring — NOT implemented in this phase):
 *   Phase 8's Cron route should call this function once per scheduled invocation with:
 *     - findDueSubscriptions: a query against subscriptions
 *         WHERE next_renewal_date <= now() AND status = 'active' AND billing_key IS NOT NULL
 *     - chargeBillingKey: `chargeBillingKey` from lib/billing/toss-client.ts (bound to real fetch)
 *     - extendSubscription: a service_role UPDATE setting expiry_date/next_renewal_date/order_id
 *         on the subscriptions row identified by subscriptionId
 *     - onChargeFailure (optional, Phase 7): wire to the Solapi/Resend pre-notice sender
 *
 * Each due subscription is processed independently — a charge failure for one subscription
 * does not prevent others from being processed. On success, expiry_date and next_renewal_date
 * are both extended by the plan's duration (reusing computeExpiryDate from Task 2.1), using
 * the CURRENT expiry_date as the new period's start (not "now"), so renewal never shortens
 * or overlaps the paid period.
 *
 * NOTE for Phase 8: this loop processes subscriptions fully sequentially (one Toss charge +
 * one persistence write at a time), which scales linearly with subscriber count. At a small
 * batch size this is fine, but a large batch will make the Cron run take proportionally
 * longer. Before wiring this into a scheduled job, confirm Toss's rate limit and consider
 * bounded-concurrency chunking (e.g. Promise.all over small batches) if the due-subscription
 * count grows large enough for that to matter.
 */
export async function renewExpiringSubscriptions(
  deps: RenewExpiringSubscriptionsDeps,
): Promise<RenewExpiringSubscriptionsResult> {
  const dueSubscriptions = await deps.findDueSubscriptions();

  const succeeded: string[] = [];
  const failed: RenewalFailure[] = [];

  for (const subscription of dueSubscriptions) {
    const amount = PLAN_PRICES_KRW[subscription.plan_type];
    const orderId = buildRenewalOrderId(subscription.id);

    try {
      await deps.chargeBillingKey({
        billingKey: subscription.billing_key,
        customerKey: subscription.customer_key,
        amount,
        orderId,
        orderName: `${subscription.plan_type} plan renewal`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ subscriptionId: subscription.id, error: message });

      if (deps.onChargeFailure) {
        await deps.onChargeFailure({
          subscriptionId: subscription.id,
          userId: subscription.user_id,
          error: message,
        });
      }
      continue;
    }

    const currentExpiry = new Date(subscription.expiry_date);
    const newExpiry = computeExpiryDate(subscription.plan_type, currentExpiry);
    const newExpiryIso = newExpiry.toISOString();

    await deps.extendSubscription(subscription.id, {
      expiry_date: newExpiryIso,
      next_renewal_date: newExpiryIso,
      order_id: orderId,
    });

    succeeded.push(subscription.id);
  }

  return { succeeded, failed };
}
