/**
 * @MX:ANCHOR: [AUTO] Cron GET /api/cron/subscription-renewal — external trigger boundary.
 * @MX:REASON: Auth contract mirrors /api/cron/reading-batch exactly: CRON_SECRET MUST be
 * set and matched; fail-closed if unset. Render Cron sends x-cron-secret (or Bearer);
 * manual/agent triggers may use either header. No unauthenticated path reaches the
 * renewal executor, which charges real money via Toss billing keys.
 * Fan-in: Render Cron scheduler + manual curl/agent triggers.
 * @MX:SPEC: SPEC-WEB-001 Phase 8 Task 8.1 (REQ-WEB-008-E4)
 *
 * @MX:NOTE: [AUTO] CRON_SECRET fail-closed: if CRON_SECRET env is unset, ALL
 * requests are rejected (401). Never open to anonymous callers.
 *
 * @MX:NOTE: [AUTO] Deps wiring: findDueSubscriptions queries subscriptions WHERE
 * next_renewal_date<=now() AND status='active' AND billing_key IS NOT NULL
 * (per renewal.ts's documented Phase 8 call signature). chargeBillingKey is bound
 * to lib/billing/toss-client.ts (real fetch). extendSubscription performs the
 * service_role UPDATE on the matched subscriptions row.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  renewExpiringSubscriptions,
  type RenewExpiringSubscriptionsDeps,
  type DueSubscription,
} from "@/lib/billing/renewal";
import { chargeBillingKey } from "@/lib/billing/toss-client";
import { isCronAuthorized } from "@/lib/cron-auth";

// ── Auth ──────────────────────────────────────────────────────────────────────
// Auth check extracted to lib/cron-auth.ts (SPEC-WEB-001 Phase 8) — was
// duplicated verbatim across all /api/cron/* routes; see isCronAuthorized().

// ── Deps factory ──────────────────────────────────────────────────────────────

/**
 * Build the real RenewExpiringSubscriptionsDeps from createAdminClient().
 *
 * findDueSubscriptions: subscriptions WHERE next_renewal_date<=now() AND
 *   status='active' AND billing_key IS NOT NULL (renewal.ts JSDoc contract).
 * chargeBillingKey: real Toss client call (no injected fetch override — uses
 *   global fetch in production).
 * extendSubscription: service_role UPDATE on the matched subscriptions row.
 */
function buildRenewalDeps(): RenewExpiringSubscriptionsDeps {
  const supabase = createAdminClient();

  const findDueSubscriptions: RenewExpiringSubscriptionsDeps["findDueSubscriptions"] =
    async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, user_id, plan_type, expiry_date, billing_key, customer_key",
        )
        .lte("next_renewal_date", nowIso)
        .eq("status", "active")
        .not("billing_key", "is", null);

      if (error || !data) {
        console.error(
          "[CronSubscriptionRenewal] findDueSubscriptions query error:",
          error,
        );
        return [];
      }

      return data as DueSubscription[];
    };

  const extendSubscription: RenewExpiringSubscriptionsDeps["extendSubscription"] =
    async (subscriptionId, params) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          expiry_date: params.expiry_date,
          next_renewal_date: params.next_renewal_date,
          order_id: params.order_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      if (error) {
        console.error(
          `[CronSubscriptionRenewal] extendSubscription failed for ${subscriptionId}:`,
          error,
        );
      }
    };

  return {
    findDueSubscriptions,
    chargeBillingKey,
    extendSubscription,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/cron/subscription-renewal
 *
 * Invoked by Render Cron (schedule: daily). Can also be triggered manually by
 * ops/agents with CRON_SECRET.
 *
 * Flow:
 *   1. Auth check (CRON_SECRET) -> 401 if invalid
 *   2. Build RenewExpiringSubscriptionsDeps from Supabase admin client + toss-client
 *   3. renewExpiringSubscriptions(deps) -> RenewExpiringSubscriptionsResult
 *   4. Return result summary JSON
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deps = buildRenewalDeps();
  const result = await renewExpiringSubscriptions(deps);

  return NextResponse.json(result);
}
