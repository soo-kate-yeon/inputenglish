// @MX:ANCHOR: [AUTO] Single writer/reader boundary for the subscriptions table (Toss billing).
// @MX:REASON: [AUTO] billing_key must NEVER appear in any API response body — this is the
//   most security-critical constraint in SPEC-WEB-001 Phase 2. sanitizeSubscription() is the
//   ONE mapper every billing route (confirm/issue/webhook) must call before returning a
//   subscription to the client. Do not bypass this by spreading a raw DB row into a response.
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.3b

import type { PlanType } from "./plans";

// (see today/route.ts / vocab-assessment-repository.ts: ReturnType<typeof createAdminClient>
// passed as `any` chain — same established pattern in this codebase).
export type AnySupabaseClient = { from: (table: string) => any }; // biome-ignore-line
type SupabaseClient = AnySupabaseClient;

/** Raw subscriptions table row shape (service_role visibility, includes billing_key). */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_type: PlanType;
  start_date: string;
  expiry_date: string;
  status: "active" | "expired" | "cancelled";
  billing_key: string | null;
  customer_key: string | null;
  next_renewal_date: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Subscription shape safe to return from any API route — billing_key/customer_key stripped. */
export type SanitizedSubscription = Omit<
  SubscriptionRow,
  "billing_key" | "customer_key"
>;

/**
 * Strips billing_key and customer_key from a subscription row. MUST be called before any
 * subscription data is included in an API response body.
 */
export function sanitizeSubscription(
  row: SubscriptionRow | null,
): SanitizedSubscription | null {
  if (!row) return null;

  const { billing_key: _billingKey, customer_key: _customerKey, ...rest } = row;
  return rest;
}

/**
 * Looks up a subscription by its Toss orderId (idempotency check for /api/billing/confirm).
 * Returns null when no row matches.
 */
export async function findSubscriptionByOrderId(
  client: SupabaseClient,
  orderId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `subscriptions: failed to look up order_id "${orderId}": ${error.message}`,
    );
  }

  return (data as SubscriptionRow | null) ?? null;
}

/**
 * Looks up a user's active subscription (status='active'). Returns null when none exists.
 * Used by the billing-key issuance route (Task 2.4) to find the subscription to attach
 * the new billing_key to.
 */
export async function findActiveSubscriptionByUserId(
  client: SupabaseClient,
  userId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(
      `subscriptions: failed to look up active subscription for user "${userId}": ${error.message}`,
    );
  }

  return (data as SubscriptionRow | null) ?? null;
}

/** Parameters accepted for a new subscription row insert. */
export interface InsertSubscriptionParams {
  user_id: string;
  plan_type: PlanType;
  start_date: string;
  expiry_date: string;
  order_id: string;
  status?: "active" | "expired" | "cancelled";
}

/** Inserts a new subscription row (service_role write) and returns the created row. */
export async function insertSubscription(
  client: SupabaseClient,
  params: InsertSubscriptionParams,
): Promise<SubscriptionRow> {
  const payload = {
    user_id: params.user_id,
    plan_type: params.plan_type,
    start_date: params.start_date,
    expiry_date: params.expiry_date,
    order_id: params.order_id,
    status: params.status ?? "active",
  };

  const { data, error } = await client
    .from("subscriptions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`subscriptions: failed to insert row: ${error.message}`);
  }

  return data as SubscriptionRow;
}

/**
 * Updates only the status column on a subscription (service_role write). Used by the
 * webhook receiver (Task 2.5) to sync subscriptions.status with a verified Toss event.
 */
export async function updateSubscriptionStatus(
  client: SupabaseClient,
  subscriptionId: string,
  status: "active" | "expired" | "cancelled",
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) {
    throw new Error(
      `subscriptions: failed to update status for id "${subscriptionId}": ${error.message}`,
    );
  }
}

/** Parameters for the billing-key issuance update (Task 2.4). */
export interface UpdateSubscriptionBillingKeyParams {
  billing_key: string;
  customer_key: string;
  next_renewal_date: string;
}

/**
 * Updates billing_key/customer_key/next_renewal_date on an existing subscription
 * (service_role write). Used by the billing-key issuance route (Task 2.4).
 */
export async function updateSubscriptionBillingKey(
  client: SupabaseClient,
  subscriptionId: string,
  params: UpdateSubscriptionBillingKeyParams,
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .update({
      billing_key: params.billing_key,
      customer_key: params.customer_key,
      next_renewal_date: params.next_renewal_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    throw new Error(
      `subscriptions: failed to update billing key for id "${subscriptionId}": ${error.message}`,
    );
  }
}
